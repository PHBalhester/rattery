import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import handler from '../api/trades';
import {TOPIC,ponsPoolId} from '../api/_lib/pons';
import {fetchAllHistory} from '../src/market/onchain';
import {createWorld} from '../src/sim/colony';
import {worldRng} from '../src/sim/rng';
import {makeReplay,tagNewHolders} from '../src/sim/replay';
const read=(p:string)=>JSON.parse(readFileSync('test-results/'+p,'utf8').replace(/^\uFEFF/,''));
const blocks=read('mainnet-zzz-blocks.json');
const c=read('mainnet-zzz-capture.json'),txs=read('mainnet-zzz-transactions.json'),grad=read('mainnet-zzz-graduation.json');
process.env.RATTERY_CHAIN_ID='4663';process.env.RATTERY_CA=c.token;process.env.RATTERY_BIRTH_BLOCK=String(c.birthBlock);process.env.RATTERY_CHUNK_BLOCKS='100';process.env.RATTERY_RPC='http://captured-rpc';
const init=grad.logs.find((l:any)=>l.topics[0]===TOPIC.initializeV4);
assert.equal(ponsPoolId(c.token),init.topics[1]);
const logs=[...new Map([...c.receipt.logs,...c.logs].map((l:any)=>[l.transactionHash+':'+l.logIndex,l])).values()] as any[];
let outage=false;
function rpc(q:any){
 if(q.method==='eth_getBlockByNumber'){assert(blocks[q.params[0]]);return blocks[q.params[0]];}
 if(q.method==='eth_chainId')return '0x1237';
 if(q.method==='eth_blockNumber')return '0x'+c.head.toString(16);
 if(q.method==='eth_getTransactionByHash'){assert(txs[q.params[0]]);return txs[q.params[0]];}
 if(q.method==='eth_getLogs'){
  const f=q.params[0],from=Number(f.fromBlock),to=Number(f.toBlock);
  assert(from>=c.birthBlock-5&&to<=c.birthBlock+99,'Refuse uncaptured history');
  return logs.filter(l=>l.address===f.address&&Number(l.blockNumber)>=from&&Number(l.blockNumber)<=to&&f.topics.every((t:any,i:number)=>t==null||(Array.isArray(t)?t.includes(l.topics[i]):t===l.topics[i])));
 }
 throw new Error('Uncaptured RPC '+q.method);
}
let apiBody:any;
globalThis.fetch=(async(url:any,options:any)=>{
 if(String(url).startsWith('/api/')){
  if(outage)return new Response('',{status:503});
  const response:any={setHeader(){},status(){return response},json(b:any){apiBody=b},end(){}};
  await handler({method:'GET',query:{chunk:new URL(String(url),'http://local').searchParams.get('chunk')!}},response);
  return Response.json(apiBody);
 }
 const q=JSON.parse(options.body),one=(x:any)=>({jsonrpc:'2.0',id:x.id,result:rpc(x)});
 return Response.json(Array.isArray(q)?q.map(one):one(q));
}) as typeof fetch;
const history=await fetchAllHistory(0);
assert.equal(history.trades.length,logs.filter(l=>[TOPIC.curveBuy,TOPIC.curveSell,TOPIC.swapV4].includes(l.topics[0])&&Number(l.blockNumber)<=c.birthBlock+99).length);
assert(history.trades.some(t=>t.venue==='pool'));assert(history.trades.some(t=>t.side==='sell'));
for(const t of history.trades){assert.equal(t.trader,txs[t.id.split(':')[0]].from);assert(t.ts>0&&Number.isFinite(t.usd)&&t.usd>=0,JSON.stringify(t));}
outage=true;await assert.rejects(fetchAllHistory(0),/503/);outage=false;assert.deepEqual(await fetchAllHistory(0),history);
function finite(x:any){if(typeof x==='number')assert(Number.isFinite(x));else if(Array.isArray(x))x.forEach(finite);else if(x&&typeof x==='object')Object.values(x).forEach(finite);}
const runs:any[]=[];
for(const mode of ['original','giant-buys','giant-sells','alternating','burst','silence'])for(const seed of [1,2,3]){
 const trades=mode==='silence'?[]:history.trades.map((t,i)=>({...t,usd:mode==='original'?t.usd:Math.max(1000,t.usd*20),side:mode==='giant-buys'?'buy':mode==='giant-sells'?'sell':mode==='alternating'?(i%2?'buy':'sell'):t.side,ts:mode==='burst'?history.t0:t.ts}));
 tagNewHolders(trades as any);
 const w=createWorld(seed),opts={t0:history.t0,targetTick:1200,tickMs:100,dtDays:1/600,maxTicks:1200};
 w.realStartedAt=history.t0;w.env.lastTradeAt=history.t0;
 const replay=makeReplay(w,worldRng(w),trades as any,opts);while(!replay.done())replay.step(73);finite(w);
 const clone=createWorld(seed);clone.realStartedAt=history.t0;clone.env.lastTradeAt=history.t0;const r=makeReplay(clone,worldRng(clone),trades as any,opts);while(!r.done())r.step(1200);assert.deepEqual(w,clone);
 runs.push({mode,seed,ticks:1200});
}
const report={token:c.token,birthBlock:c.birthBlock,scope:'Captured first 100 blocks only; NOT full history. Recent canonical pool window had zero logs; other pools observed separately.',trades:history.trades.length,buys:history.trades.filter(t=>t.side==='buy').length,sells:history.trades.filter(t=>t.side==='sell').length,poolTrades:history.trades.filter(t=>t.venue==='pool').length,uniqueSenders:new Set(history.trades.map(t=>t.trader)).size,runs,ticksIncludingDeterminism:43200,outageRecovery:true,poolIdVerified:true};
writeFileSync('test-results/mainnet-zzz-test.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));

writeFileSync('test-results/mainnet-zzz-browser-data.json',JSON.stringify({token:c.token,birthBlock:c.birthBlock,poolId:ponsPoolId(c.token),head:c.head,t0:history.t0,chunks:[apiBody]},null,2));
