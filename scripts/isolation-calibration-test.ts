import assert from 'node:assert/strict';
import {createWorld} from '../src/sim/colony';
import {ecologyStep} from '../src/sim/ecology';
import {colonyMetrics} from '../src/sim/colonyMetrics';
import {decayEnv} from '../src/sim/marketMap';
import {CONFIG} from '../src/config';
const w=createWorld(42);const rats=Object.values(w.rats);rats.forEach((r,i)=>{r.x=i*500;r.y=0});
for(let i=0;i<60;i++){w.simDay+=.01;ecologyStep(w,.01)}assert.equal(colonyMetrics(w).isolation,0,'short excursions must not trigger distress');
for(let i=0;i<600;i++){w.simDay+=.01;ecologyStep(w,.01)}assert(colonyMetrics(w).isolation>.9);assert(rats.every(r=>r.wellbeing!.isolationDistress!>.9));
const copy=structuredClone(w);ecologyStep(w,.01);ecologyStep(copy,.01);assert.deepEqual(w,copy,'snapshot determinism');
rats.forEach(r=>{r.x=800;r.y=520});for(let i=0;i<210;i++){w.simDay+=.01;ecologyStep(w,.01)}assert.equal(colonyMetrics(w).isolation,0,'company relieves prolonged isolation');
let e=createWorld().env;for(let day=0;day<20;day++)e=decayEnv(e,CONFIG.time.realMsPerSimDay/1000);assert(e.food>.44&&e.water!>.5&&e.warmth>.48,'twenty quiet days must not empty resources');
const chunks=createWorld().env;let split=chunks;for(let i=0;i<200;i++)split=decayEnv(split,CONFIG.time.realMsPerSimDay/10000);for(const k of ['food','water','warmth'] as const)assert(Math.abs(e[k]!-split[k]!)<1e-9);
console.log('PASS: excursion grace, prolonged isolation, reunion recovery, snapshot determinism, twenty-day resource budget and timestep independence');

const {tick}=await import('../src/sim/tick');const {worldRng}=await import('../src/sim/rng');const quiet=createWorld(42),rng=worldRng(quiet);for(let i=0;i<12000;i++)tick(quiet,CONFIG.time.tickMs/CONFIG.time.realMsPerSimDay,rng);const living=Object.values(quiet.rats).filter(r=>r.deadAt===null);console.log({quietDays:quiet.simDay,living:living.length,food:quiet.env.food,energies:living.map(r=>r.energy)});assert.equal(living.length,4,'founders survive twenty quiet days');
