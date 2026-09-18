import {randomUUID} from 'node:crypto';
import type {Pool,PoolClient} from 'pg';
import type {World,Rat,MemorialRecord} from '../src/types';
import {careState,validateCare,applyCare,CARE_RULES,type CareAction,type CareEvent} from '../src/sim/care.js';
import {tokenUnits} from '../src/market/burn.js';
import {verifyBurn,type BurnRPC} from '../api/_lib/burn.js';
import {StagingAuth,digest} from './auth.js';
import {CONFIG} from '../src/config.js';
import {tick} from '../src/sim/tick.js';
import {applyQueuedTrades} from './trade-ledger.js';
import {worldRng} from '../src/sim/rng.js';
export const ENGINE_VERSION='shared-colony-v9:'+digest(JSON.stringify(CONFIG)).slice(0,16);
export const MAX_SIMULATION_BATCH=40;
const uuid=(s:string)=>/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(s);
export class Persistence{
 constructor(readonly pool:Pool,readonly auth:StagingAuth,readonly token:string,readonly decimals:number,readonly rpc:BurnRPC,readonly clock=Date.now){
  if(!/^0x[0-9a-f]{40}$/.test(token)||/^0x0{40}$/.test(token))throw Error('Invalid payment token');
  tokenUnits(1,decimals);
 }
 async transaction<T>(work:(c:PoolClient)=>Promise<T>){
  const c=await this.pool.connect();try{await c.query('BEGIN');await c.query("SET LOCAL lock_timeout='5s'");const value=await work(c);await c.query('COMMIT');return value;}catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
 }
 // Operator-only seeding. There is intentionally no HTTP endpoint for replacing the world.
 async initialize(world:World){
  return this.transaction(async c=>{
   const inserted=await c.query('INSERT INTO colony_state(id,world) VALUES(1,$1) ON CONFLICT DO NOTHING RETURNING id',[world]);
   if(inserted.rowCount)await this.records(c,world);
  });
 }
 async checkpoint(world:World,expectedRevision:number){
  if(!Number.isSafeInteger(expectedRevision)||expectedRevision<0)throw Error('Invalid revision');
  return this.transaction(async c=>{
   const row=(await c.query('SELECT revision,world FROM colony_state WHERE id=1 FOR UPDATE')).rows[0];
   if(!row||Number(row.revision)!==expectedRevision)throw Error('Stale checkpoint');
   if(JSON.stringify(world.care??null)!==JSON.stringify(row.world.care??null))throw Error('Checkpoint cannot replace payment state');
   await this.records(c,world);
   await c.query('UPDATE colony_state SET world=$1,revision=revision+1 WHERE id=1',[world]);
  });
 }
 private async records(c:PoolClient,world:World){
  const records={...world.memorial,...world.rats};
  for(const r of Object.values(records) as (Rat|MemorialRecord)[]){
   for(const parent of [r.motherId,r.fatherId]){
    if(parent){const ancestor=records[parent]??(await c.query('SELECT record FROM rat_records WHERE id=$1',[parent])).rows[0]?.record;
     if(!ancestor||ancestor.bornAt>=r.bornAt)throw Error('Invalid genealogy');}
   }
   const prior=(await c.query('SELECT * FROM rat_records WHERE id=$1',[r.id])).rows[0];
   if(prior&&(prior.born_at!==r.bornAt||prior.mother_id!==r.motherId||prior.father_id!==r.fatherId||(prior.dead_at!==null&&prior.dead_at!==r.deadAt)))throw Error('Immutable identity/death');
   await c.query('INSERT INTO rat_records(id,name,born_at,mother_id,father_id,dead_at,record) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(id) DO UPDATE SET name=excluded.name,dead_at=excluded.dead_at,record=excluded.record',[r.id,r.name,r.bornAt,r.motherId,r.fatherId,r.deadAt,r]);
  }
 }
 async reserve(session:string,requestId:string,ratId:string,action:CareAction,name?:string){
  const wallet=await this.auth.wallet(session);
  if(!uuid(requestId)||typeof ratId!=='string'||ratId.length>80||!Object.hasOwn(CARE_RULES,action)||(name!==undefined&&(typeof name!=='string'||name.length>128)))throw Error('Invalid request');
  let available:bigint|null=null;
  if(this.auth.chainId===4663&&CARE_RULES[action].cost>0){
   if(Number(await this.rpc('eth_chainId',[]))!==4663)throw Error('Wrong payment network');
   const balance=await this.rpc('eth_call',[{to:this.token,data:'0x70a08231'+wallet.slice(2).padStart(64,'0')},'latest']);
   if(typeof balance!=='string'||!/^0x[0-9a-f]{1,64}$/i.test(balance))throw Error('Balance unavailable');available=BigInt(balance);
  }
  return this.transaction(async c=>{
   const state=(await c.query('SELECT * FROM colony_state WHERE id=1 FOR UPDATE')).rows[0];
   if(!state)throw Error('Colony unavailable');
   this.requireCurrentSimulation(state);
   await c.query("UPDATE care_intents SET status='cancelled' WHERE status='reserved' AND submission_started_at IS NULL AND expires_at<$1",[this.clock()]);
   const prior=(await c.query('SELECT * FROM care_intents WHERE wallet=$1 AND request_id=$2',[wallet,requestId])).rows[0];
   if(prior){
    if(prior.rat_id!==ratId||prior.action!==action||prior.name!==(name??null))throw Error('Idempotency mismatch');
    return prior;
   }
   if(Number((await c.query("SELECT count(*) FROM care_intents WHERE wallet=$1 AND status IN ('reserved','review')",[wallet])).rows[0].count)>=5)throw Error('Resolve pending actions first');
   const ownership=(await c.query('SELECT wallet FROM rat_ownership WHERE rat_id=$1',[ratId])).rows[0];
   if(ownership&&(ownership.wallet!==wallet||action==='mint'))throw Error('Ownership conflict');
   const world=state.world as World,care=world.care??careState(),now=this.clock();
   validateCare(world,care,{sequence:care.lastSequence+1,ratId,wallet,action,name,timestamp:now,amount:CARE_RULES[action].cost});
   // EVM timestamps have whole-second precision. Include the reservation's second.
   const cost=CARE_RULES[action].cost,units=cost===0?0n:tokenUnits(cost,this.decimals);
   if(available!==null){const held=BigInt((await c.query("SELECT coalesce(sum(units),0)::text AS units FROM care_intents WHERE wallet=$1 AND status='reserved'",[wallet])).rows[0].units);if(available<held+units)throw Error('Insufficient unreserved balance');}
   return (await c.query('INSERT INTO care_intents(id,wallet,rat_id,request_id,action,name,cost,units,chain_id,token,created_at,expires_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$12,$9,$10,$11) RETURNING *',[randomUUID(),wallet,ratId,requestId,action,name??null,cost,units.toString(),this.token,Math.floor(now/1000)*1000,now+300000,this.auth.chainId])).rows[0];
  });
 }
 async finalize(session:string,id:string,hash?:string){
  return this.finalizeForWallet(await this.auth.wallet(session),id,hash);
 }
 private async finalizeForWallet(wallet:string,id:string,hash?:string){
  if(!uuid(id))throw Error('Invalid intent');
  const intent=(await this.pool.query('SELECT * FROM care_intents WHERE id=$1 AND wallet=$2',[id,wallet])).rows[0];
  if(!intent)throw Error('Intent unavailable');
  if(intent.chain_id!==this.auth.chainId||intent.token!==this.token)throw Error('Intent market mismatch');
  if(intent.status!=='reserved')return {status:intent.status,id};
  const verified=intent.cost===0?null:await verifyBurn(this.rpc,hash??'',{chainId:intent.chain_id,token:intent.token,wallet,amount:BigInt(intent.units),createdAt:Number(intent.created_at),expiresAt:Number(intent.expires_at)});
  return this.transaction(async c=>{
   // Common lock order: world, then intent. No deadlock against reservations.
   const row=(await c.query('SELECT * FROM colony_state WHERE id=1 FOR UPDATE')).rows[0];
   this.requireCurrentSimulation(row);
   const locked=(await c.query('SELECT * FROM care_intents WHERE id=$1 AND wallet=$2 FOR UPDATE',[id,wallet])).rows[0];
   if(locked.status!=='reserved')return {status:locked.status,id};
   if(verified)await c.query('INSERT INTO burn_receipts(receipt_key,intent_id,chain_id,token,tx_hash,evidence) VALUES($1,$2,$3,$4,$5,$6)',[verified.key,id,intent.chain_id,intent.token,verified.hash,verified]);
   const world=row.world as World,care=world.care??careState();
   const event:CareEvent={sequence:care.lastSequence+1,ratId:intent.rat_id,wallet,action:intent.action,name:intent.name??undefined,amount:intent.cost,timestamp:Math.max(this.clock(),care.lastTimestamp??0)};
   let status='applied';
   try{applyCare(world,care,event);}catch(e){
    if(!verified)throw e;
    // A paid but now ineligible action remains recorded for operator resolution.
    // Do not silently discard the receipt or charge the user a second time.
    status='review';
   }
   if(status==='applied'){
    if(intent.action==='mint')await c.query('INSERT INTO rat_ownership(rat_id,wallet,mint_intent) VALUES($1,$2,$3)',[intent.rat_id,wallet,id]);
    world.care=care;
    await c.query('UPDATE colony_state SET world=$1,revision=revision+1 WHERE id=1',[world]);
    await this.records(c,world);
    await c.query('INSERT INTO care_events(intent_id,event,created_at) VALUES($1,$2,$3)',[id,event,this.clock()]);
   }
   await c.query('UPDATE care_intents SET status=$2 WHERE id=$1',[id,status]);
   return {status,id};
  });
 }
 private requireCurrentSimulation(row:any){
  if(row.engine_version&&(row.engine_version!==ENGINE_VERSION||this.clock()-Number(row.simulation_at)>1000))throw Error('Colony catching up');
 }
 // Operator-only clock advancement. Never exposed as an HTTP mutation.
 async advanceSimulation(at=this.clock()){
  if(!Number.isSafeInteger(at)||at<0)throw Error('Invalid simulation time');
  return this.transaction(async c=>{
   const row=(await c.query('SELECT * FROM colony_state WHERE id=1 FOR UPDATE')).rows[0];
   if(!row)throw Error('Colony unavailable');
   if(row.engine_version&&row.engine_version!==ENGINE_VERSION)throw Error('Simulation version mismatch');
   const world=row.world as World;
   const previous=row.simulation_at===null?Math.floor(world.realStartedAt+world.simDay*CONFIG.time.realMsPerSimDay):Number(row.simulation_at);
   const due=Math.max(0,Math.floor((at-previous)/CONFIG.time.tickMs)),steps=Math.min(due,MAX_SIMULATION_BATCH);
   const rng=worldRng(world);
   for(let i=0;i<steps;i++){
    // jsonb may reorder object keys. Pin rat traversal order before every tick.
    world.rats=Object.fromEntries(Object.entries(world.rats).sort(([a],[b])=>a<b?-1:a>b?1:0));
    await applyQueuedTrades(c,world,previous+(i+1)*CONFIG.time.tickMs,Number(row.simulation_tick)+i+1);
    tick(world,CONFIG.time.tickMs/CONFIG.time.realMsPerSimDay,rng);
   }
   const reached=previous+steps*CONFIG.time.tickMs;
   if(steps||!row.engine_version){
    if(steps)await this.records(c,world);
    await c.query('UPDATE colony_state SET world=$1,revision=revision+1,simulation_tick=simulation_tick+$2,simulation_at=$3,engine_version=$4 WHERE id=1',[world,steps,reached,ENGINE_VERSION]);
   }
   return {steps,tick:Number(row.simulation_tick)+steps,lagMs:Math.max(0,at-reached),version:ENGINE_VERSION};
  });
 }
 async sharedSnapshot(){
  const row=(await this.pool.query('SELECT * FROM colony_state WHERE id=1')).rows[0];
  if(!row)throw Error('Colony unavailable');
  return {world:row.world as World,revision:Number(row.revision),tick:Number(row.simulation_tick),at:Number(row.simulation_at),version:row.engine_version as string|null};
 }
 async overview(session:string){
  const wallet=await this.auth.wallet(session);
  const state=(await this.pool.query(`SELECT world,revision,(SELECT coalesce(jsonb_agg(i ORDER BY i.created_at::bigint DESC,i.id),'[]'::jsonb) FROM (SELECT id,rat_id,request_id,action,name,cost,units::text,chain_id,token,created_at::text,expires_at::text,status,submission_started_at::text,submitted_hash FROM care_intents WHERE wallet=$1 ORDER BY created_at DESC,id LIMIT 20) i) AS intents FROM colony_state WHERE id=1`,[wallet])).rows[0];
  if(!state)throw Error('Colony unavailable');
  const world=state.world as World;
  const residence=this.auth.chainId===4663?(await this.pool.query('SELECT verified_ms::text,checked_at::text,value_micros::text,status FROM holder_residence WHERE wallet=$1',[wallet])).rows[0]??null:null;
  return {residence,wallet,chainId:this.auth.chainId,token:this.token,decimals:this.decimals,revision:Number(state.revision),
   rats:Object.values(world.rats).sort((a,b)=>Number(a.deadAt!==null)-Number(b.deadAt!==null)).slice(0,250).map(r=>({id:r.id,name:r.name,dead:r.deadAt!==null,owner:world.care?.owners[r.id]??null,energy:r.energy,hydration:r.wellbeing?.hydration??null})),
   intents:state.intents};
 }
 async beginSubmission(session:string,id:string){
  const wallet=await this.auth.wallet(session);
  if(!uuid(id))throw Error('Invalid intent');
  return this.transaction(async c=>{
   const state=(await c.query('SELECT * FROM colony_state WHERE id=1 FOR UPDATE')).rows[0];this.requireCurrentSimulation(state);
   const intent=(await c.query('SELECT * FROM care_intents WHERE id=$1 AND wallet=$2 FOR UPDATE',[id,wallet])).rows[0];
   if(!intent||intent.status!=='reserved'||intent.cost<=0||intent.submission_started_at!==null||Number(intent.expires_at)<=this.clock()||intent.chain_id!==this.auth.chainId||intent.token!==this.token)throw Error('Submission already started or unavailable');
   const care=state.world.care??careState();
   validateCare(state.world,care,{sequence:care.lastSequence+1,ratId:intent.rat_id,wallet,action:intent.action,name:intent.name??undefined,timestamp:this.clock(),amount:intent.cost});
   await c.query('UPDATE care_intents SET submission_started_at=$2 WHERE id=$1',[id,this.clock()]);return {id,started:true};
  });
 }
 async cancel(session:string,id:string){
  const wallet=await this.auth.wallet(session);if(!uuid(id))throw Error('Invalid intent');
  const result=await this.pool.query("UPDATE care_intents SET status='cancelled' WHERE id=$1 AND wallet=$2 AND status='reserved' AND submission_started_at IS NULL RETURNING id",[id,wallet]);
  if(result.rowCount!==1)throw Error('Submitted actions cannot be cancelled');return {id,status:'cancelled'};
 }
 async rememberSubmission(session:string,id:string,hash:string){
  const wallet=await this.auth.wallet(session);
  if(!uuid(id)||typeof hash!=='string'||!/^0x[0-9a-f]{64}$/i.test(hash))throw Error('Invalid submission');
  const result=await this.pool.query("UPDATE care_intents SET submitted_hash=$3 WHERE id=$1 AND wallet=$2 AND status='reserved' AND submission_started_at IS NOT NULL AND (submitted_hash IS NULL OR submitted_hash=$3) RETURNING id",[id,wallet,hash.toLowerCase()]);
  if(result.rowCount!==1)throw Error('Submission unavailable');
  // This is a recovery hint, not evidence. finalize still verifies the chain independently.
  return {id,remembered:true};
 }
 async reconcileSubmitted(limit=5){
  if(!Number.isInteger(limit)||limit<1||limit>10)throw Error('Invalid reconciliation limit');
  const rows=(await this.pool.query("SELECT id,wallet,submitted_hash FROM care_intents WHERE status='reserved' AND submitted_hash IS NOT NULL ORDER BY coalesce(reconcile_at,0),created_at LIMIT $1",[limit])).rows;
  let applied=0,review=0,pending=0;
  for(const i of rows){
   await this.pool.query('UPDATE care_intents SET reconcile_at=$2 WHERE id=$1',[i.id,this.clock()]);
   try{const result=await this.finalizeForWallet(i.wallet,i.id,i.submitted_hash);if(result.status==='applied')applied++;else if(result.status==='review')review++;}catch{pending++;}
  }
  return {checked:rows.length,applied,review,pending};
 }
 async memorial(after='',limit=20){
  if(typeof after!=='string'||after.length>80||!Number.isInteger(limit)||limit<1||limit>50)throw Error('Invalid pagination');
  return (await this.pool.query('SELECT record FROM rat_records WHERE dead_at IS NOT NULL AND id>$1 ORDER BY id LIMIT $2',[after,limit])).rows.map(r=>r.record);
 }
 async rat(id:string){if(typeof id!=='string'||id.length>80)throw Error('Invalid rat');return (await this.pool.query('SELECT record FROM rat_records WHERE id=$1',[id])).rows[0]?.record??null;}
}
