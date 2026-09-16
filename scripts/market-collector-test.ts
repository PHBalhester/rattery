import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {Pool} from 'pg';
import {TOPIC} from '../api/_lib/pons.js';
import {StagingAuth} from '../server/auth.js';
import {Persistence} from '../server/persistence.js';
import {TradeLedger} from '../server/trade-ledger.js';
import {HistoricalPrices,PRICE_SOURCE} from '../server/historical-prices.js';
import {discoverMarket,MarketCollector} from '../server/market-collector.js';
import {readOnlyRPC,boundedJSON,blockTag} from '../server/market-io.js';
import {createWorld} from '../src/sim/colony.js';
if(!process.env.PGDATABASE?.endsWith('_test'))throw Error('Isolated test database required');
const schema='collector_'+randomUUID().replaceAll('-',''),admin=new Pool();await admin.query('CREATE SCHEMA '+schema);await admin.end();
const db=new Pool({max:10,options:'-c search_path='+schema+',public'});
const time=1800000000000,token='0x'+'a'.repeat(40),curve='0x'+'b'.repeat(40),wallet='0x'+'c'.repeat(40);
const factory='0x7ed598bcef8bd9edd8c97a195c6d13f40801ec7e',manager='0x8366a39cc670b4001a1121b8f6a443a643e40951';
const h=(n:number)=>'0x'+n.toString(16).padStart(64,'0'),topic=(a:string)=>'0x'+a.slice(2).padStart(64,'0'),word=(n:bigint)=>BigInt.asUintN(256,n).toString(16).padStart(64,'0');
let now=time+10000,mode='',poolId='',calls=0,priceCalls=0,priceMode='';
const block=(n:number)=>({number:blockTag(n),hash:mode==='anchor'&&n===12?h(777):h(n),parentHash:h(n-1),timestamp:blockTag(time/1000)});
const log=(n:number,address:string,topics:string[],data:string)=>({address,topics,data,blockNumber:blockTag(n),blockHash:h(n),transactionHash:h(n+100),logIndex:'0x0',removed:false});
const rpc=async(method:string,args:any[])=>{
 calls++;
 if(method==='eth_chainId')return mode==='chain'?'0x1':'0x1237';
 if(method==='eth_blockNumber')return '0x28';
 if(method==='eth_getBlockByNumber')return block(Number(args[0]));
 if(method==='eth_getTransactionByHash')return {hash:h(112),blockHash:mode==='tx'?h(222):h(12),blockNumber:'0xc',from:wallet};
 if(method==='eth_getLogs'){
  const f=args[0],n=Number(f.fromBlock);
  if(n===5)return [log(5,factory,[TOPIC.tokenLaunched,topic(token),topic(curve),topic(wallet)],'0x'+word(0n)+word(0n)+word(4200000000000000000n))];
  if(n===11&&f.address===curve){const l=log(11,curve,[TOPIC.curveBuy,topic(wallet),topic(wallet)],'0x'+word(500000000000000000n)+word(1n)+word(0n)+word(0n));if(mode==='removed')l.removed=true;if(mode==='membership')l.blockHash=h(222);return mode==='duplicate'?[l,l]:[l];}
  if(n===12&&f.address===manager)return [log(12,manager,[TOPIC.swapV4,mode==='pool'?h(999):poolId,topic(wallet)],'0x'+word(-250000000000000000n)+word(100n)+word(1n)+word(1n)+word(0n)+word(0n))];
  return [];
 }
 throw Error('Forbidden fixture RPC');
};
const fetcher=(async(url:any)=>{
 priceCalls++;assert(String(url).startsWith('https://api.exchange.coinbase.com/products/ETH-USD/candles?'));
 if(priceMode==='outage')return new Response('',{status:503});
 const row=[time/1000-60,1900,2100,1950,2000,10];
 if(priceMode==='invalid')row[4]=9000;
 return Response.json(priceMode==='missing'?[]:priceMode==='duplicate'?[row,row]:[row,[time/1000,2000,2100,2050,2070,10]]);
}) as typeof fetch;
let groups=0;const ok=(s:string)=>console.log('PASS',++groups,s);
try{
 for(const f of ['001_staging','002_auth_expiry','003_submission_recovery','004_shared_simulation','005_trade_ledger','006_market_collector'])await db.query(readFileSync('server/migrations/'+f+'.sql','utf8'));
 const auth=new StagingAuth(db,'http://localhost:18756',()=>now),service=new Persistence(db,auth,token,18,async()=>null,()=>now);
 const w=createWorld();w.realStartedAt=now;await service.initialize(w);await service.advanceSimulation();
 const prices=new HistoricalPrices(db,fetcher),ledger=new TradeLedger(service,new Set([PRICE_SOURCE]));
 mode='chain';await assert.rejects(discoverMarket(rpc,token,5),/chain/);mode='';
 const config=await discoverMarket(rpc,token,5);poolId=config.poolId;
 assert.equal(config.curve,curve);
 const collector=new MarketCollector(ledger,rpc,config,prices);await collector.start(10);
 await assert.rejects(new MarketCollector(ledger,rpc,{...config,confirmations:21},prices).start(10),/configuration/);
 ok('Verified factory/native ETH discovery and pinned configuration reject wrong network and changes');
 for(const failure of ['removed','membership','duplicate']){mode=failure;await assert.rejects(collector.poll(1));assert.equal(Number((await db.query('SELECT last_block FROM trade_stream')).rows[0].last_block),10);}
 mode='';priceMode='outage';assert.equal((await collector.poll(1)).trades,1);
 assert.equal((await db.query('SELECT status FROM colony_trades')).rows[0].status,'pending');
 ok('Removed, duplicate and mismatched logs reject; price outage retains verified trade');
 for(const failure of ['missing','invalid','duplicate']){priceMode=failure;if(failure==='missing')assert.equal(await prices.quote(time),null);else await assert.rejects(prices.quote(time));}
 priceMode='';const q=await prices.quote(time+59000);assert.equal(q?.observedAt,time);assert.equal(q?.usdMicrosPerEth,'2000000000');
 const priorCalls=priceCalls;await prices.quote(time+1000);assert.equal(priceCalls,priorCalls);
 assert.equal((await collector.retryPrices()).resolved,1);
 await assert.rejects(collector.retryPrices(1000));await assert.rejects(collector.poll(1000));
 ok('Only previous closed minute is used; malformed/missing candles reject, cache and recovery work');
 for(const failure of ['pool','tx']){mode=failure;await assert.rejects(collector.poll(1));assert.equal(Number((await db.query('SELECT last_block FROM trade_stream')).rows[0].last_block),11);}
 mode='';const accepted=await collector.poll(1);assert.equal(accepted.trades,1);
 const events=(await db.query('SELECT raw,valuation FROM colony_trades ORDER BY block_number')).rows;
 assert.equal(events[0].raw.ethWei,'500000000000000000');assert.equal(events[1].raw.ethWei,'250000000000000000');
 assert.equal(events[0].valuation.tier,'giant');assert.equal(events[1].valuation.tier,'large');
 now+=100;await service.advanceSimulation();assert.equal(Number((await db.query("SELECT count(*) FROM colony_trades WHERE status='applied'")).rows[0].count),2);
 ok('Exact curve/pool ETH amounts and transaction membership drive persistent effects');
 const role='worker_'+randomUUID().replaceAll('-','');
 await db.query('CREATE ROLE '+role+' NOLOGIN');
 await db.query('GRANT USAGE ON SCHEMA '+schema+' TO '+role);
 await db.query('GRANT SELECT,INSERT,UPDATE ON colony_state,rat_records,trade_stream,colony_trades TO '+role);
 await db.query('GRANT SELECT,INSERT ON trade_blocks,market_quotes TO '+role);
 const restricted=new Pool({options:'-c search_path='+schema+',public -c role='+role});
 try{
  const limitedService=new Persistence(restricted,new StagingAuth(restricted,'http://localhost:18756',()=>now),token,18,async()=>null,()=>now);
  now+=100;await limitedService.advanceSimulation();
  await new HistoricalPrices(restricted,fetcher).quote(time);
  assert.equal((await restricted.query('SELECT pg_try_advisory_lock(4663,20260916) AS acquired')).rows[0].acquired,true);
  await restricted.query('SELECT pg_advisory_unlock(4663,20260916)');
  for(const sql of ['SELECT * FROM auth_sessions','SELECT * FROM care_intents','SELECT * FROM burn_receipts','ALTER TABLE colony_state ADD COLUMN forbidden integer']){
   await assert.rejects(restricted.query(sql),/permission denied|must be owner/);
  }
 }finally{await restricted.end();}
 ok('Restricted worker role advances biology and reads prices but cannot access payments/auth or alter tables');
 mode='anchor';await assert.rejects(collector.poll(1),/anchor/);assert.equal((await db.query('SELECT halted FROM trade_stream')).rows[0].halted,true);
 mode='';await assert.rejects(new MarketCollector(ledger,rpc,config,prices).start(10),/unavailable/);
 await assert.rejects(new MarketCollector(ledger,rpc,config,prices).poll(1),/unavailable/);
 ok('A changed persisted anchor survives restart as a durable market halt');
 let transports=0;
 const read=readOnlyRPC('https://rpc.example.invalid',(async(_u,init)=>{transports++;const body=JSON.parse(String(init?.body));return Response.json({jsonrpc:'2.0',id:body.id,result:'0x1237'});}) as typeof fetch);
 await assert.rejects(read('eth_sendRawTransaction',['0x00']),/denied/);assert.equal(transports,0);assert.equal(await read('eth_chainId',[]),'0x1237');
 assert.throws(()=>readOnlyRPC('http://example.invalid'));const credentialFixture=new URL('https://example.invalid');credentialFixture.username='fixture';credentialFixture.password='fixture';assert.throws(()=>readOnlyRPC(credentialFixture.href));
 await assert.rejects(boundedJSON('https://example.invalid',{},3,(async()=>new Response('12345')) as typeof fetch),/large/);
 ok('Transport denies all writes before network access and bounds upstream response size');
 console.log('ALL PASS',groups,'RPC fixture calls',calls);
}finally{await db.end();}
