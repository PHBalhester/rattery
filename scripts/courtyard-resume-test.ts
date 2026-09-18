import assert from 'node:assert/strict';
import {createWorld} from '../src/sim/colony';
import {tick} from '../src/sim/tick';
import {worldRng} from '../src/sim/rng';
import {CONFIG} from '../src/config';
const w=createWorld(42),base=Object.values(w.rats)[0];
for(let i=4;i<90;i++){const r=structuredClone(base);r.id='resume-'+i;r.pregnant=null;r.nursing=[];w.rats[r.id]=r;}
const dt=CONFIG.time.tickMs/CONFIG.time.realMsPerSimDay;
for(let i=0;i<100;i++)tick(w,dt,worldRng(w));
assert(Object.values(w.rats).some(r=>r.exploration?.den!==undefined),'active den reservation at checkpoint');
const restored=JSON.parse(JSON.stringify(w));
for(let i=0;i<150;i++){tick(w,dt,worldRng(w));tick(restored,dt,worldRng(restored));}
assert.deepEqual(w,restored);
console.log('PASS: JSON restart preserves exact 90-rat world, RNG, paths and active den reservations over 150 subsequent ticks');
