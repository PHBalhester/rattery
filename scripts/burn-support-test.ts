import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {Pool} from 'pg';
import {applyBurnSupport} from '../src/sim/burnSupport.js';
import {createWorld} from '../src/sim/colony.js';
import {Persistence} from '../server/persistence.js';
import {StagingAuth} from '../server/auth.js';
import {TradeLedger,type BurnEvent} from '../server/trade-ledger.js';
import {MarketCollector,BURN_TRANSFER} from '../server/market-collector.js';
const h=(n:number)=>'0x'+n.toString(16).padStart(64,'0'),token='0x'+'a'.repeat(40),from='0x'+'b'.repeat(40);
const units=(n:number)=>(BigInt(n)*10n**18n).toString();
let now=1800000000000;
const world=createWorld(),rat=Object.values(world.rats)[0];
for(const r of Object.values(world.rats))r.wellbeing={acute:.2,chronic:0,hydration:.9,lastWater:0,cause:'test',support:0,crowding:0,zone:0};
rat.wellbeing!.hydration=0;
world.env.food=world.env.water=.95;world.env.warmth=.65;world.env.stress=.1;
for(const r of Object.values(world.rats)){r.energy=.9;r.wellbeing!.acute=.2;if(r!==rat)r.wellbeing!.hydration=.9;}
const before=structuredClone(world);
assert(Math.abs(applyBurnSupport(world,units(10000),now,h(1)).points-.15)<1e-9);
assert(Math.abs(rat.wellbeing!.hydration-.15)<1e-9);assert.deepEqual(world.care,before.care);assert.deepEqual(world.totals,before.totals);
const single=structuredClone(before),split=structuredClone(before);
for(const w of [single,split])for(const r of Object.values(w.rats)){r.energy=0;r.wellbeing!.hydration=0;r.wellbeing!.acute=1;}
const large=applyBurnSupport(single,units(10000000),now,h(2));let points=0;
for(let i=0;i<100;i++)points+=applyBurnSupport(split,units(100000),now,h(3)).points;
assert(large.points<=3+1e-9);assert(points<=3+1e-9);assert(Math.abs(points-large.points)<1e-9);
assert.equal(applyBurnSupport(single,units(100000),now,h(4)).points,0);
assert(applyBurnSupport(single,units(100000),now+3600000,h(4)).points>0);
assert.throws(()=>applyBurnSupport(single,'-1',now,h(4)));
console.log('PASS needs priority, proportional relief, split-resistant shared cap, budget refill, identities preserved');
if(!process.env.PGDATABASE?.endsWith('_test'))throw Error('Isolated test database required');
const schema='burn_'+randomUUID().replaceAll('-',''),admin=new Pool();await admin.query('CREATE SCHEMA '+schema);await admin.end();
const db=new Pool({options:'-c search_path='+schema+',public'});
try{
 for(const f of ['001_staging','002_auth_expiry','003_submission_recovery','004_shared_simulation','005_trade_ledger','006_market_collector','012_burn_support'])await db.query(readFileSync('server/migrations/'+f+'.sql','utf8'));
 const service=new Persistence(db,new StagingAuth(db,'http://localhost:18756',()=>now),token,18,async()=>null,()=>now);
 const w=createWorld();w.realStartedAt=now;await service.initialize(w);await service.advanceSimulation();
 const ledger=new TradeLedger(service,new Set());await ledger.initialize(4663,token,{number:10,hash:h(10),timestamp:now});
 const burn:BurnEvent={chainId:4663,token,hash:h(100),logIndex:1,timestamp:now,from,units:units(10000)};
 const b={number:11,hash:h(11),parentHash:h(10),timestamp:now,events:[],burns:[burn]};
 const results=await Promise.all(Array.from({length:8},()=>ledger.ingest(b,null)));assert.equal(results.filter(r=>!r.duplicate).length,1);
 await db.query("CREATE FUNCTION fail_tick() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'rollback test'; END $$; CREATE TRIGGER fail_tick BEFORE UPDATE ON colony_state FOR EACH ROW EXECUTE FUNCTION fail_tick()");
 now+=100;await assert.rejects(service.advanceSimulation(),/rollback test/);assert.equal((await db.query('SELECT applied_tick FROM colony_burns')).rows[0].applied_tick,null);
 await db.query('DROP TRIGGER fail_tick ON colony_state; DROP FUNCTION fail_tick()');
 await Promise.all(Array.from({length:5},()=>service.advanceSimulation()));
 assert.equal((await service.sharedSnapshot()).world.burnSupport?.events,1);
 assert.equal((await service.sharedSnapshot()).world.burnSupport?.units,units(10000));
 console.log('PASS concurrent collection/application, atomic rollback and retry, exact once');
 // Collector only accepts true token Transfer-to-zero events with canonical membership.
 let mode='valid';const cfg={chainId:4663,token,birthBlock:5,curve:'0x'+'c'.repeat(40),poolId:h(777),factory:'0x'+'d'.repeat(40),manager:'0x'+'e'.repeat(40),hook:'0x'+'f'.repeat(40),confirmations:20};
 const rpc=async(method:string,args:any[])=>{
  if(method==='eth_chainId')return '0x1237';if(method==='eth_blockNumber')return '0x20';
  if(method==='eth_getBlockByNumber'){const n=Number(args[0]);return {number:args[0],hash:h(n),parentHash:h(n-1),timestamp:'0x'+Math.floor(now/1000).toString(16)};}
  if(method==='eth_getLogs'){
   if(args[0].address!==token)return [];
   assert.deepEqual(args[0].topics,[BURN_TRANSFER,null,h(0)]);
   return [{address:token,topics:[BURN_TRANSFER,'0x'+from.slice(2).padStart(64,'0'),mode==='dead'?'0x'+'dead'.padStart(64,'0'):h(0)],data:h(10000),blockNumber:'0xc',blockHash:mode==='branch'?h(55):h(12),transactionHash:h(101),logIndex:'0x0',removed:mode==='removed'}];
  }throw Error('Unexpected RPC');
 };
 const collector=new MarketCollector(ledger,rpc,cfg,{quote:async()=>{throw Error('Burn must not require ETH quote');}});await collector.start(10);
 for(const failure of ['dead','removed','branch']){mode=failure;await assert.rejects(collector.poll());assert.equal(Number((await db.query('SELECT last_block FROM trade_stream')).rows[0].last_block),11);}
 mode='valid';await collector.poll();now+=100;await service.advanceSimulation();
 assert.equal((await service.sharedSnapshot()).world.burnSupport?.events,2);
 assert.equal((await db.query('SELECT count(*) FROM colony_trades')).rows[0].count,'0');
 assert.equal((await collector.poll()).accepted,0);
 console.log('PASS true burns, wrong destination/removed/reorg rejection, no trade or price dependency, resumed cursor');
}finally{await db.end();const cleanup=new Pool();await cleanup.query('DROP SCHEMA '+schema+' CASCADE');await cleanup.end();}
