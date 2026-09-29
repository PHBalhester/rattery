import {createServer} from 'node:http';
import {timingSafeEqual} from 'node:crypto';
import type {Pool} from 'pg';
import type {World,Trade} from '../src/types.js';
export const OBSERVER_LIMIT=4*1024*1024;
export async function readObservation(pool:Pool,runId='rattery-staging-round1'){
 if(!/^rattery-(?:staging|production)-[a-z0-9-]{1,48}$/.test(runId))throw Error('Invalid run');
 const c=await pool.connect();
 try{await c.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
  const row=(await c.query('SELECT world,revision,simulation_tick,simulation_at,engine_version FROM colony_state WHERE id=1')).rows[0];
  if(!row||!row.engine_version)throw Error('Unavailable');
  const market=(await c.query('SELECT chain_id,token,last_block,last_timestamp,halted FROM trade_stream WHERE id=1')).rows[0];
  const recent=(await c.query("SELECT identity,raw,valuation,block_number,log_index FROM colony_trades WHERE status='applied' ORDER BY block_number DESC,log_index DESC LIMIT 30")).rows;
  const holders=(await c.query('SELECT wallet,verified_ms,eligible,checked_at FROM holder_residence')).rows;
  const tiers=new Map(holders.map(h=>[h.wallet,h.eligible&&Date.now()-Number(h.checked_at)<180000?(Number(h.verified_ms)>=7776000000?90:Number(h.verified_ms)>=2592000000?30:Number(h.verified_ms)>=604800000?7:0):0]));
  await c.query('COMMIT');
  // Payment/account state is never part of the public observation response.
  const {care:_care,demoToken:_demo,...world}=row.world as World;
  const trades:Trade[]=recent.map(r=>({id:r.identity,ts:r.raw.timestamp,side:r.raw.side,eth:Number(r.raw.ethWei)/1e18,usd:Number(r.valuation.usdMicros)/1e6,tokens:0,trader:r.raw.trader,isNewHolder:false,venue:r.raw.venue,block:Number(r.block_number),logIndex:r.log_index}));
  return {protocol:1,runId,colonyId:runId.startsWith('rattery-production-')?'rattery-production-v1':'rattery-staging-market-v1',world:{...world,memorial:Object.fromEntries(Object.entries(world.memorial??{}).map(([id,record])=>[id,{...record,caregiver:!!_care?.owners[id],residenceDays:tiers.get(_care?.owners[id]??'')??0}])),rats:Object.fromEntries(Object.entries(world.rats).map(([id,rat])=>[id,{...rat,minted:!!_care?.owners[id],caregiver:!!_care?.owners[id],residenceDays:tiers.get(_care?.owners[id]??'')??0,petAt:(_care?.cooldowns[id+':pet']??0)-3600000}]))},revision:Number(row.revision),tick:Number(row.simulation_tick),at:Number(row.simulation_at),version:row.engine_version,market:market?{chainId:market.chain_id,token:market.token,block:Number(market.last_block),at:Number(market.last_timestamp),halted:market.halted}:null,trades,paymentsEnabled:runId.startsWith('rattery-production-')};
 }catch(e){await c.query('ROLLBACK').catch(()=>{});throw e;}finally{c.release();}
}
export const BURNER_LIMIT=50;
export const BURNER_SEASON_START=1790611200000; // 28 September 2026, 13:00 America/Sao_Paulo.
export type BurnerNest='NVDA'|'AAPL'|'AMZN'|null;
export type BurnerRecord={block:number;logIndex:number;hash:string;from:string;units:string};
export interface BurnerChain {
 owner(burn:BurnerRecord):Promise<string>;
 nests(wallets:string[]):Promise<BurnerNest[]>;
}
/** Season-only read model. The historical ledger and simulation effects are never modified. */
export async function readBurners(pool:Pool,limit=BURNER_LIMIT,chain?:BurnerChain){
 if(!Number.isInteger(limit)||limit<1||limit>100)throw Error('Invalid limit');
 const c=await pool.connect();let market:any,rows:any[];
 try{await c.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
  market=(await c.query('SELECT chain_id,token FROM trade_stream WHERE id=1')).rows[0];
  rows=(await c.query("SELECT block_number,log_index,raw FROM colony_burns WHERE (raw->>'timestamp')::bigint >= $1 ORDER BY block_number,log_index",[BURNER_SEASON_START])).rows;
  await c.query('COMMIT');
 }catch(e){await c.query('ROLLBACK').catch(()=>{});throw e;}finally{c.release();}
 const grouped=new Map<string,{wallet:string;units:bigint;burns:number}>();let total=0n;
 // Resolve the router's burns to the emitting action's player, never the transaction sender.
 for(const row of rows){
  const burn:BurnerRecord={block:Number(row.block_number),logIndex:row.log_index,hash:row.raw.hash,from:String(row.raw.from).toLowerCase(),units:row.raw.units};
  if(!/^[0-9]{1,78}$/.test(burn.units))throw Error('Invalid burn');
  const wallet=chain?await chain.owner(burn):burn.from;
  if(!/^0x[0-9a-f]{40}$/.test(wallet))throw Error('Invalid burner');
  const entry=grouped.get(wallet)??{wallet,units:0n,burns:0};entry.units+=BigInt(burn.units);entry.burns++;total+=BigInt(burn.units);grouped.set(wallet,entry);
 }
 const leaders=[...grouped.values()].sort((a,b)=>a.units===b.units?a.wallet.localeCompare(b.wallet):a.units>b.units?-1:1).slice(0,limit);
 const nests=chain?await chain.nests(leaders.map(r=>r.wallet)):leaders.map(()=>null);
 return {protocol:1,kind:'burners',season:1,startsAt:BURNER_SEASON_START,chainId:Number(market?.chain_id)||null,token:typeof market?.token==='string'?market.token.toLowerCase():null,at:Date.now(),
  totalUnits:String(total),burns:rows.length,wallets:grouped.size,firstBlock:rows.length?Number(rows[0].block_number):null,lastBlock:rows.length?Number(rows[rows.length-1].block_number):null,
  leaders:leaders.map((r,i)=>({wallet:r.wallet,units:String(r.units),burns:r.burns,nest:nests[i]}))};
}
/** Dedicated read-only service. Authenticated proxy requests share one bounded cache. */
export function observerServer(read:()=>Promise<unknown>,secret:string,clock=Date.now,readBurnersRoute?:()=>Promise<unknown>){
 if(!/^[a-f0-9]{64}$/.test(secret))throw Error('Observer credential required');
 const expected=Buffer.from('Bearer '+secret);let cache='',expires=0,inflight:Promise<string>|undefined,window=0,hits=0;
 let burnCache='',burnExpires=0,burnInflight:Promise<string>|undefined;
 const server=createServer(async(req,res)=>{
  res.setHeader('Content-Type','application/json');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Cache-Control','no-store');res.setHeader('Content-Security-Policy',"default-src 'none'; frame-ancestors 'none'");
  const send=(code:number,value:string)=>{res.writeHead(code);res.end(value);};
  if(req.url==='/health'&&req.method==='GET')return send(200,'{"ok":true}');
  const burners=req.url==='/burners'&&!!readBurnersRoute;
  if(req.url!=='/snapshot'&&!burners)return send(404,'{"error":"Not found"}');
  if(req.method!=='GET'){res.setHeader('Allow','GET');return send(405,'{"error":"GET required"}');}
  const auth=Buffer.from(req.headers.authorization??'');if(auth.length!==expected.length||!timingSafeEqual(auth,expected))return send(401,'{"error":"Unauthorized"}');
  if(req.headers['content-length']&&req.headers['content-length']!=='0'||req.headers['transfer-encoding'])return send(400,'{"error":"Body not allowed"}');
  const now=clock(),minute=Math.floor(now/60000);if(window!==minute){window=minute;hits=0;}if(++hits>1200){res.setHeader('Retry-After','60');return send(429,'{"error":"Rate limit"}');}
  if(burners){
   try{if(!burnCache||burnExpires<=now){burnInflight??=readBurnersRoute!().then(data=>{const text=JSON.stringify(data);if(Buffer.byteLength(text)>65536)throw Error('Leaderboard size');burnCache=text;burnExpires=clock()+30000;return text;}).finally(()=>{burnInflight=undefined;});await burnInflight;}send(200,burnCache);}catch{send(503,'{"error":"Leaderboard unavailable"}');}
   return;
  }
  try{if(!cache||expires<=now){inflight??=read().then(data=>{const text=JSON.stringify(data);if(Buffer.byteLength(text)>OBSERVER_LIMIT)throw Error('Snapshot size');cache=text;expires=clock()+500;return text;}).finally(()=>{inflight=undefined;});await inflight;}send(200,cache);}catch{send(503,'{"error":"Observation unavailable"}');}
 });
 server.requestTimeout=5000;server.headersTimeout=5000;server.timeout=5000;server.maxHeadersCount=30;return server;
}
