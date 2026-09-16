import type {PoolClient} from 'pg';
import type {Persistence} from './persistence.js';
import type {World} from '../src/types.js';
import {historicalValuation,type HistoricalQuote,type HistoricalTrade} from './valuation.js';
import {digest} from './auth.js';
import {CONFIG} from '../src/config.js';
import {applyTrade} from '../src/sim/marketMap.js';

export interface MarketEvent extends HistoricalTrade {
 side:'buy'|'sell';
 venue:'curve'|'pool';
 trader:string;
}
export interface MarketBlock {
 number:number;hash:string;parentHash:string;timestamp:number;
 events:MarketEvent[];
}
const hash=(s:string)=>/^0x[0-9a-f]{64}$/.test(s);
const address=(s:string)=>/^0x[0-9a-f]{40}$/.test(s);
const natural=(n:number)=>Number.isSafeInteger(n)&&n>=0;

/** Trusted collector boundary, never an HTTP/browser mutation.
 * The caller must independently verify RPC chain, finalized depth, block/log
 * membership and decoder output. This ledger cannot prove those facts itself.
 */
export class TradeLedger {
 constructor(readonly service:Persistence,readonly quoteSources:ReadonlySet<string>){}
 async initialize(chainId:number,token:string,anchor:{number:number;hash:string;timestamp:number}){
  if(![4663,46630].includes(chainId)||!address(token)||/^0x0{40}$/.test(token)||!natural(anchor.number)||!hash(anchor.hash)||!natural(anchor.timestamp))throw Error('Invalid market anchor');
  return this.service.transaction(async c=>{
   await c.query('SELECT id FROM colony_state WHERE id=1 FOR UPDATE');
   await c.query('INSERT INTO trade_stream(id,chain_id,token,last_block,last_hash,last_timestamp) VALUES(1,$1,$2,$3,$4,$5) ON CONFLICT DO NOTHING',[chainId,token,anchor.number,anchor.hash,anchor.timestamp]);
   const row=(await c.query('SELECT * FROM trade_stream WHERE id=1')).rows[0];
   if(row.chain_id!==chainId||row.token!==token)throw Error('Market identity mismatch');
  });
 }
 async ingest(block:MarketBlock,quote:HistoricalQuote|null){
  if(!natural(block.number)||!natural(block.timestamp)||!hash(block.hash)||!hash(block.parentHash)||!Array.isArray(block.events)||block.events.length>1000)throw Error('Invalid market block');
  const events=[...block.events].sort((a,b)=>a.logIndex-b.logIndex);
  const entries=events.map(e=>{
   if(e.timestamp!==block.timestamp||!['buy','sell'].includes(e.side)||!['curve','pool'].includes(e.venue)||!address(e.trader))throw Error('Invalid market event');
   const raw:MarketEvent={chainId:e.chainId,token:e.token,hash:e.hash,logIndex:e.logIndex,timestamp:e.timestamp,ethWei:e.ethWei,side:e.side,venue:e.venue,trader:e.trader};
   const value=historicalValuation(raw,quote,this.quoteSources);
   if(value.status==='classified'&&BigInt(value.usdMicros)>BigInt(Number.MAX_SAFE_INTEGER))throw Error('Trade notional exceeds supported range');
   return {raw,value};
  });
  if(new Set(events.map(e=>e.logIndex)).size!==events.length)throw Error('Duplicate block log');
  const fingerprint=digest(JSON.stringify({number:block.number,hash:block.hash,parentHash:block.parentHash,timestamp:block.timestamp,events:entries.map(e=>e.raw)}));
  const result=await this.service.transaction(async c=>{
   const state=(await c.query('SELECT * FROM colony_state WHERE id=1 FOR UPDATE')).rows[0];
   if(!state||state.simulation_at===null)throw Error('Initialize shared simulation first');
   const stream=(await c.query('SELECT * FROM trade_stream WHERE id=1')).rows[0];
   if(!stream||stream.halted)throw Error('Market stream unavailable');
   if(entries.some(e=>e.raw.chainId!==stream.chain_id||e.raw.token!==stream.token))throw Error('Market identity mismatch');
   const prior=(await c.query('SELECT * FROM trade_blocks WHERE block_number=$1',[block.number])).rows[0];
   if(prior){
    if(prior.fingerprint===fingerprint)return {duplicate:true};
    await c.query('UPDATE trade_stream SET halted=true WHERE id=1');return {halted:true};
   }
   if(block.number!==Number(stream.last_block)+1)throw Error('Noncontiguous market block');
   if(block.parentHash!==stream.last_hash||block.timestamp<Number(stream.last_timestamp)){
    await c.query('UPDATE trade_stream SET halted=true WHERE id=1');return {halted:true};
   }
   if(block.timestamp>this.service.clock())throw Error('Future market block');
   await c.query('INSERT INTO trade_blocks VALUES($1,$2,$3)',[block.number,block.hash,fingerprint]);
   for(const e of entries)await c.query('INSERT INTO colony_trades(identity,block_number,log_index,raw,valuation,status,available_at) VALUES($1,$2,$3,$4,$5,$6,$7)',[e.value.identity,block.number,e.raw.logIndex,e.raw,e.value,e.value.status==='pending'?'pending':'ready',Math.max(block.timestamp,Number(state.simulation_at)+CONFIG.time.tickMs)]);
   await c.query('UPDATE trade_stream SET last_block=$1,last_hash=$2,last_timestamp=$3 WHERE id=1',[block.number,block.hash,block.timestamp]);
   return {duplicate:false};
  });
  if('halted' in result)throw Error('Market continuity conflict; stream halted for review');
  return result;
 }
 async resolve(identity:string,quote:HistoricalQuote){
  return this.service.transaction(async c=>{
   const state=(await c.query('SELECT * FROM colony_state WHERE id=1 FOR UPDATE')).rows[0];
   const row=(await c.query('SELECT * FROM colony_trades WHERE identity=$1',[identity])).rows[0];
   if(!row)throw Error('Unknown trade');
   const value=historicalValuation(row.raw,quote,this.quoteSources);
   if(value.status!=='classified'||BigInt(value.usdMicros)>BigInt(Number.MAX_SAFE_INTEGER))throw Error('Invalid valuation');
   if(row.status!=='pending'){
    if(row.valuation.quote.source!==quote.source||row.valuation.quote.observedAt!==quote.observedAt||row.valuation.quote.usdMicrosPerEth!==quote.usdMicrosPerEth)throw Error('Valuation is immutable');
    return;
   }
   await c.query("UPDATE colony_trades SET valuation=$2,status='ready',available_at=$3 WHERE identity=$1",[identity,value,Math.max(Number(row.available_at),Number(state.simulation_at)+CONFIG.time.tickMs)]);
  });
 }
}

/** Called under the world lock, in the same transaction as biology and RNG.
 * Pending quotes block later trades, but never stop biology or paid care.
 * Bound each tick's work; any remainder is retained for the next tick.
 */
export async function applyQueuedTrades(c:PoolClient,world:World,at:number,tick:number){
 const stream=(await c.query('SELECT halted FROM trade_stream WHERE id=1')).rows[0];
 if(!stream||stream.halted)return;
 const rows=(await c.query("SELECT * FROM colony_trades WHERE status<>'applied' ORDER BY block_number,log_index LIMIT 200")).rows;
 for(const row of rows){
  if(row.status==='pending'||Number(row.available_at)>at)break;
  const raw=row.raw as MarketEvent;
  // Keep block time in the immutable ledger. Effects use their actual simulation
  // application time, so late quotes cannot rewind the reaction budget.
  world.env=applyTrade(world.env,{id:row.identity,ts:at,side:raw.side,eth:Number(BigInt(raw.ethWei))/1e18,usd:Number(BigInt(row.valuation.usdMicros))/1e6,tokens:0,trader:raw.trader,isNewHolder:false,venue:raw.venue,block:Number(row.block_number),logIndex:row.log_index});
  await c.query("UPDATE colony_trades SET status='applied',applied_tick=$2,applied_at=$3 WHERE identity=$1",[row.identity,tick,at]);
 }
}
