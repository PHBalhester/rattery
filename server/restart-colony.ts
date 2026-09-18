import type {Pool} from 'pg';
import {createWorld} from '../src/sim/colony.js';
import type {World} from '../src/types.js';
import {ENGINE_VERSION} from './persistence.js';

/** Operator only. No HTTP route and no automatic restart on extinction. */
export async function restartColony(pool:Pool,options:{transitionId:string;expectedRevision:string;expectedVersion:string;commit?:boolean},clock=Date.now){
 if(!/^[a-z0-9-]{8,80}$/.test(options.transitionId)||!/^\d+$/.test(options.expectedRevision)||!options.expectedVersion)throw Error('Invalid restart options');
 const c=await pool.connect();
 try{
  await c.query('BEGIN');
  await c.query("SET LOCAL lock_timeout='5s'");
  if(!(await c.query('SELECT pg_try_advisory_xact_lock(4663,20260916) AS acquired')).rows[0].acquired)throw Error('Stop worker before restart');
  // Payment paths lock colony_state first too. Keep that order, then freeze their ledgers.
  const row=(await c.query('SELECT * FROM colony_state WHERE id=1 FOR UPDATE')).rows[0];
  if(!row||String(row.revision)!==options.expectedRevision||row.engine_version!==options.expectedVersion)throw Error('Stale restart plan');
  await c.query('LOCK TABLE care_intents,rat_ownership,burn_receipts,care_events,rat_records IN SHARE ROW EXCLUSIVE MODE');
  const old=row.world as World;
  if(!old.extinct||Object.values(old.rats).some(r=>r.deadAt===null))throw Error('Restart requires an extinct colony');
  if((await c.query("SELECT 1 FROM care_intents WHERE status IN ('reserved','review') LIMIT 1")).rowCount)throw Error('Resolve pending payments before restart');
  const owned=await c.query('SELECT rat_id,wallet FROM rat_ownership');
  for(const o of owned.rows)if(old.care?.owners[o.rat_id]!==o.wallet)throw Error('Ownership ledger mismatch');
  const seq=(await c.query("SELECT coalesce(max((event->>'sequence')::bigint),0)::text AS n FROM care_events")).rows[0].n;
  if(BigInt(seq)!==BigInt(old.care?.lastSequence??0))throw Error('Care sequence mismatch');
  const ids=(await c.query('SELECT id FROM rat_records')).rows.map(r=>r.id as string);
  let next=BigInt(old.nextId);
  for(const id of ids){const m=/([0-9]+)$/.exec(id);if(m&&BigInt(m[1])>=next)next=BigInt(m[1])+1n;}
  if(next>BigInt(Number.MAX_SAFE_INTEGER-1000000))throw Error('Rat identifier space exhausted');
  const now=clock(),world=createWorld(old.seed),fresh=Object.values(world.rats);
  world.realStartedAt=now;world.env.lastTradeAt=now;world.nextId=Number(next);
  world.rats={};world.events=[];
  for(const rat of fresh){rat.id='F'+world.nextId++;world.rats[rat.id]=rat;}
  // Keep paid history, cooldowns and sequence exactly; old IDs never identify new rats.
  if(old.care)world.care=structuredClone(old.care);
  await c.query('INSERT INTO colony_engine_history(transition_id,from_version,to_version,simulation_tick,simulation_at,revision,world) VALUES($1,$2,$3,$4,$5,$6,$7)',[options.transitionId,row.engine_version,ENGINE_VERSION,row.simulation_tick,row.simulation_at,row.revision,old]);
  for(const rat of fresh)await c.query('INSERT INTO rat_records(id,name,born_at,mother_id,father_id,dead_at,record) VALUES($1,$2,$3,NULL,NULL,NULL,$4)',[rat.id,rat.name,rat.bornAt,rat]);
  // Tick stays monotonic: historical trade application coordinates remain unambiguous.
  await c.query('UPDATE colony_state SET world=$1,revision=revision+1,simulation_at=$2,engine_version=$3 WHERE id=1',[world,now,ENGINE_VERSION]);
  const result={committed:!!options.commit,transitionId:options.transitionId,founders:fresh.length,version:ENGINE_VERSION,revision:(BigInt(row.revision)+1n).toString(),historicalRats:ids.length};
  await c.query(options.commit?'COMMIT':'ROLLBACK');return result;
 }catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
}
