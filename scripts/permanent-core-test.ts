import assert from 'node:assert/strict';
import {createWorld,spawnRat,kill,enforceCap} from '../src/sim/colony';
import {mulberry32,worldRng} from '../src/sim/rng';
import {tick} from '../src/sim/tick';
import {snakeEligible,snakeStep} from '../src/sim/snake';
import {assistPermanentCore} from '../src/sim/permanentCore';
import {CONFIG} from '../src/config';
import type {DeathCause} from '../src/types';
function fixture(){
 const w=createWorld(24),rng=mulberry32(24),base=Object.values(w.rats)[0];
 for(const sex of ['F','M'] as const)spawnRat(w,rng,{sex,bornAt:-60,stage:'adult',gen:0,motherId:null,fatherId:null,genome:{...base.genome},x:800,y:520,energy:1});
 w.permanentCore={ratIds:Object.keys(w.rats),activatedAt:1000};return w;
}
const w=fixture(),ids=[...w.permanentCore!.ratIds];
assert.equal(ids.length,6);assert.equal(ids.filter(id=>w.rats[id].sex==='F').length,3);
for(const cause of ['age','starvation','cold','neonatal_abandon','neonatal_cannibal','stillbirth','crowding','predation'] as DeathCause[]){
 for(const id of ids)kill(w,w.rats[id],cause);
}
assert(ids.every(id=>w.rats[id].deadAt===null));assert.equal(w.totals.deaths,0);
const extra=spawnRat(w,mulberry32(2),{sex:'M',bornAt:-1000,stage:'adult',gen:0,motherId:null,fatherId:null,genome:{...w.rats[ids[0]].genome},x:900,y:500,energy:1});
w.careProtection={active:true,until:2000};
for(const id of ids){w.rats[id].bornAt=-1000;w.rats[id].energy=0;}
tick(w,CONFIG.time.simDaysPerTick,worldRng(w),undefined,2000);
assert.equal(w.careProtection.active,false);assert(ids.every(id=>w.rats[id].deadAt===null&&w.rats[id].energy>=.9));assert.equal(extra.deathCause,'age');
w.env={...w.env,food:.05,water:.05,warmth:.05,stress:1,panic:1};
const env=structuredClone(w.env);assistPermanentCore(w);assert.deepEqual(w.env,env);
w.snake={nextAttack:0,capture:{ratId:ids[0],started:-1,x:1180,y:735}};
assert.equal(snakeEligible(w,w.rats[ids[0]]),false);snakeStep(w,1,()=>0);assert.equal(w.snake.capture,undefined);
// Two hours of production ticks, no trades, with adults already over age.
for(let i=0;i<600*120;i++)tick(w,CONFIG.time.simDaysPerTick,worldRng(w),{...env},3000+i*100);
assert.equal(w.extinct,false);assert(ids.every(id=>w.rats[id].deadAt===null&&w.rats[id].energy>=.9));
// Extended 48-hour equivalent silence at a coarse step, in addition to exact-step coverage.
for(let i=0;i<2880;i++)tick(w,1,worldRng(w),{...env},8000000+i*60000);
assert.equal(w.extinct,false);assert(ids.every(id=>w.rats[id].deadAt===null&&w.rats[id].energy>=.9));
const copy=structuredClone(w);
for(let i=0;i<50;i++){tick(w,CONFIG.time.simDaysPerTick,worldRng(w),undefined,8000000+i*100);tick(copy,CONFIG.time.simDaysPerTick,worldRng(copy),undefined,8000000+i*100);}
assert.deepEqual(w,copy);
const crowded=fixture(),rng=mulberry32(9);
while(Object.values(crowded.rats).length<=CONFIG.colony.maxAlive)spawnRat(crowded,rng,{sex:'M',bornAt:-60,stage:'adult',gen:0,motherId:null,fatherId:null,genome:{...extra.genome},x:800,y:520,energy:1});
for(const id of crowded.permanentCore!.ratIds)crowded.rats[id].bornAt=-2000;
enforceCap(crowded);assert.equal(crowded.totals.deaths,1);assert(crowded.permanentCore!.ratIds.every(id=>crowded.rats[id].deadAt===null));
const legacy=createWorld();kill(legacy,Object.values(legacy.rats)[0],'age');assert.equal(legacy.totals.deaths,1);
console.log('PASS: six fixed identities, all death causes, temporary expiry, individual care, snake exclusion, 120 exact-step simulated days plus 48-hour equivalent silence, deterministic reload, crowding and legacy behavior');
