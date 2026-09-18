import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {Pool} from 'pg';
import {readOnlyRPC} from '../server/market-io.js';
import {discoverMarket,MarketCollector} from '../server/market-collector.js';
import {HistoricalPrices,PRICE_SOURCE} from '../server/historical-prices.js';
import {TradeLedger} from '../server/trade-ledger.js';
import {Persistence} from '../server/persistence.js';
import {StagingAuth} from '../server/auth.js';
import {createWorld} from '../src/sim/colony.js';
if(!process.env.PGDATABASE?.endsWith('_test'))throw Error('Isolated local test database required');
const marketAddress=(process.env.RATTERY_CAPTURE_TOKEN || '0x7dbf38976f6d3b9c529e7d9484a71898b409ee6a').toLowerCase(),birthBlock=Number(process.env.RATTERY_CAPTURE_BIRTH_BLOCK ?? 54672454);
assert.match(marketAddress,/^0x[0-9a-f]{40}$/);
assert(Number.isSafeInteger(birthBlock)&&birthBlock>0);
const selected=Number(process.env.RATTERY_CAPTURE_BLOCK??birthBlock);
if(!Number.isSafeInteger(selected)||selected<birthBlock)throw Error('Invalid capture block');
const schema='live_market_'+randomUUID().replaceAll('-',''),admin=new Pool();await admin.query('CREATE SCHEMA '+schema);await admin.end();
const pool=new Pool({options:'-c search_path='+schema+',public'});
const transport=readOnlyRPC(process.env.RATTERY_CAPTURE_RPC || 'https://rpc.mainnet.chain.robinhood.com/rpc');let requests=0;
let queue:Promise<unknown>=Promise.resolve();
const rpc=(method:string,args:unknown[])=>{const next=queue.then(async()=>{if(++requests>80)throw Error('Live RPC budget exceeded');await new Promise(r=>setTimeout(r,1500));return transport(method,args);});queue=next.catch(()=>{});return next;};
try{
 for(const name of ['001_staging','002_auth_expiry','003_submission_recovery','004_shared_simulation','005_trade_ledger','006_market_collector'])await pool.query(readFileSync('server/migrations/'+name+'.sql','utf8'));
 const auth=new StagingAuth(pool,'http://localhost:18756'),service=new Persistence(pool,auth,marketAddress,18,async()=>{throw Error('No financial RPC');});
 const world=createWorld();await service.initialize(world);await service.advanceSimulation();
 const config=await discoverMarket(rpc,marketAddress,birthBlock),prices=new HistoricalPrices(pool),ledger=new TradeLedger(service,new Set([PRICE_SOURCE])),collector=new MarketCollector(ledger,rpc,config,prices);
 await collector.start(selected-1);const result=await collector.poll(1);
 assert(result.trades>0,'Chosen historical block must contain a verified marketAddress trade');
 const retry=await collector.retryPrices();const rows=(await pool.query('SELECT identity,raw,valuation,status FROM colony_trades ORDER BY block_number,log_index')).rows;
 assert(rows.every(r=>r.status==='ready'),'Every captured event must have a real historical price');
 await new Promise(r=>setTimeout(r,120));await service.advanceSimulation();
 assert.equal(Number((await pool.query("SELECT count(*) FROM colony_trades WHERE status='applied'")).rows[0].count),rows.length);
 const duplicate=await collector.poll(1); // subsequent canonical block; restart resumes, never replays prior
 const report={chainId:4663,marketAddress,selected,requests,result,retry,next:duplicate,events:rows,scope:'Read-only public mainnet RPC and Coinbase history; writes only to isolated local PostgreSQL. No wallet or chain transactions.'};
 mkdirSync('test-results/market-collector',{recursive:true});writeFileSync('test-results/market-collector/live.json',JSON.stringify(report,null,2));
 console.log(JSON.stringify({passed:true,chainId:4663,selected,requests,trades:result.trades,quoteSource:PRICE_SOURCE,report:'test-results/market-collector/live.json'}));
}finally{await pool.end();}
