import assert from 'node:assert/strict';
import {createWorld,tryConceive,deliverLitter,inNest} from '../src/sim/colony';
import {applyHabitatActivity} from '../src/sim/habitatActivity';
import {walkable} from '../src/sim/navigation';
import {worldRng} from '../src/sim/rng';
import {tick} from '../src/sim/tick';
import {CONFIG} from '../src/config';
const w=createWorld(),rats=Object.values(w.rats),moms=rats.filter(r=>r.sex==='F'),dad=rats.find(r=>r.sex==='M')!,rng=worldRng(w);
for(const m of moms)assert(tryConceive(w,()=>.5,m,dad,1,w.env));
applyHabitatActivity(w);
assert(moms.every(m=>m.maternalNest&&m.maternalNest.zone>0));assert.notEqual(moms[0].maternalNest!.zone,moms[1].maternalNest!.zone);
for(const m of moms){const home=m.maternalNest!;m.x=home.x;m.y=home.y;deliverLitter(w,()=>.5,m,w.env);assert(m.nursing.length>0);for(const id of m.nursing){const p=w.rats[id];assert.deepEqual(p.maternalNest,home);assert(inNest(p));assert(walkable(p));}}
const homes=JSON.stringify(moms.map(m=>m.maternalNest));applyHabitatActivity(w);assert.equal(JSON.stringify(moms.map(m=>m.maternalNest)),homes);
const clone=JSON.parse(JSON.stringify(w));tick(w,CONFIG.time.simDaysPerTick,worldRng(w));tick(clone,CONFIG.time.simDaysPerTick,worldRng(clone));assert.deepEqual(w,clone);
for(let i=0;i<1200;i++)tick(w,CONFIG.time.simDaysPerTick,rng);
for(const m of moms){assert(m.nursing.length>0);for(const id of m.nursing){const p=w.rats[id];assert.equal(p.deadAt,null);assert(p.heat>.4);assert(Math.hypot(p.x-m.maternalNest!.x,p.y-m.maternalNest!.y)<90);}}
console.log('PASS separated litter reservations, births at family shelter, walkable pups, nursing continuity, warmth and JSON resume');
