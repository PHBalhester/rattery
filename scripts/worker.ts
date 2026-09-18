import {ResidenceWorker} from '../server/residence.js';
import {Pool} from 'pg';
import {StagingAuth} from '../server/auth.js';
import {Persistence} from '../server/persistence.js';
import {TradeLedger} from '../server/trade-ledger.js';
import {HistoricalPrices,PRICE_SOURCE} from '../server/historical-prices.js';
import {readOnlyRPC} from '../server/market-io.js';
import {discoverMarket,MarketCollector} from '../server/market-collector.js';
import {startWorkerRuntime} from '../server/worker-runtime.js';
import {createWorld} from '../src/sim/colony.js';

async function main(){
 const production=process.env.RATTERY_WORKER_MODE==='production';
 if(!production&&process.env.RATTERY_WORKER_MODE!=='staging-readonly')throw Error('Explicit worker mode required');
 const raw=process.env.RATTERY_WORKER_DATABASE_URL;if(!raw)throw Error('Dedicated staging worker database required');
 const database=new URL(raw);
 if(!['postgres:','postgresql:'].includes(database.protocol)||!(production?database.pathname==='/rattery_production':database.pathname.endsWith('_worker_staging'))||database.search)throw Error('Dedicated worker staging database required, without URL options');
 const pool=new Pool({connectionString:raw,ssl:{rejectUnauthorized:true,...(process.env.RATTERY_WORKER_DATABASE_CA?{ca:process.env.RATTERY_WORKER_DATABASE_CA}:{})},max:4,connectionTimeoutMillis:10000,statement_timeout:20000,idle_in_transaction_session_timeout:30000});
 let stop:(()=>Promise<void>)|undefined;
 const lease=await pool.connect().catch(async()=>{await pool.end();throw Error('Worker database connection failed');});
 try{
  // A dedicated database is required because this connection pins the lease.
  // Transaction-pooling database URLs must not be used.
  if(!(await lease.query('SELECT pg_try_advisory_lock(4663,20260916) AS acquired')).rows[0].acquired)throw Error('Worker already active');
  const token=process.env.RATTERY_MARKET_TOKEN??'',birth=Number(process.env.RATTERY_MARKET_BIRTH_BLOCK),start=Number(process.env.RATTERY_MARKET_START_BLOCK);
  if(!Number.isSafeInteger(start)||start<1)throw Error('Explicit market start block required');
  const rpc=readOnlyRPC(process.env.RATTERY_MARKET_RPC??'https://rpc.mainnet.chain.robinhood.com/rpc');
  const config=await discoverMarket(rpc,token,birth);
  if(production&&token!=='0xc322305e79337300b59ff48389f8c9a1d9e0de76')throw Error('Wrong production token');
  const service=new Persistence(pool,new StagingAuth(pool,production?'https://rattery.tech':'https://rattery-staging.vercel.app',Date.now,production?4663:46630),token,18,production?rpc:async()=>{throw Error('Financial execution disabled in market worker');});
  // Migrations are performed separately by an operator, never by runtime credentials.
  const exists=(await pool.query('SELECT id FROM colony_state WHERE id=1')).rowCount;
  if(!exists){if(production)throw Error('Production world must be migrated by operator');if(process.env.RATTERY_WORKER_BOOTSTRAP!=='new-staging-colony')throw Error('Explicit new-colony bootstrap required');await service.initialize(createWorld());}
  if(!exists)await service.advanceSimulation();
  const collector=new MarketCollector(new TradeLedger(service,new Set([PRICE_SOURCE])),rpc,config,new HistoricalPrices(pool));
  await collector.start(start-1);
  await service.advanceSimulation();
  let finish!:()=>void;const finished=new Promise<void>(resolve=>{finish=resolve;});
  const stopSignal=()=>finish();
  process.once('SIGTERM',stopSignal);process.once('SIGINT',stopSignal);
  const databaseFailure=()=>{process.exitCode=1;finish();};
  lease.on('error',databaseFailure);pool.on('error',databaseFailure);
  const residence=production?new ResidenceWorker(pool,rpc):null;
  stop=startWorkerRuntime(service,collector,event=>console.log(JSON.stringify(event)),production,residence?()=>residence.poll():undefined);
  console.log(JSON.stringify({event:'worker_started',chainId:4663,financialExecution:production}));
  await finished;
  const deadline=setTimeout(()=>process.exit(1),25000);deadline.unref();
  await stop();stop=undefined;clearTimeout(deadline);
  process.off('SIGTERM',stopSignal);process.off('SIGINT',stopSignal);
 }finally{
  if(stop)await stop();
  try{await lease.query('SELECT pg_advisory_unlock(4663,20260916)');}finally{lease.release();await pool.end();}
 }
}
main().catch(()=>{console.error('Worker stopped: configuration, database or upstream validation failed. Credentials and raw errors are withheld.');process.exitCode=1;});
