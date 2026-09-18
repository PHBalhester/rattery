import assert from 'node:assert/strict';
import {applyTrade} from '../src/sim/marketMap.js';
import {createWorld} from '../src/sim/colony.js';import {tick} from '../src/sim/tick.js';import {worldRng} from '../src/sim/rng.js';import {CONFIG} from '../src/config.js';import type {Trade} from '../src/types.js';
// Survival claims made at a coarse dt do not automatically transfer to the live
// worker: a larger step draws fewer per-tick RNG samples. This test runs the
// supported scenario at exactly CONFIG.time.simDaysPerTick, the step the worker
// uses, so the claim is checked at production resolution at least once.
// The horizon is deliberately short: this test answers "does the live step
// starve a supported colony?", not "does it survive 120 days?". The long
// horizon is covered at coarse dt in survival-support-test, which is ~6x
// cheaper per simulated day. 30 sim-days = 18000 ticks, roughly 20s.
const dt=CONFIG.time.simDaysPerTick;
const ticks=Math.round(30/dt),every=Math.round(10/dt);
const trade=(usd:number,ts:number):Trade=>({id:String(ts),ts,side:'buy',usd,eth:usd/2400,tokens:0,trader:'test',venue:'demo'});
const w=createWorld(CONFIG.colony.seed),rng=worldRng(w);
for(let i=0;i<ticks;i++){
 if(i%every===0)w.env=applyTrade(w.env,trade(100,i*dt*CONFIG.time.realMsPerSimDay));
 tick(w,dt,rng);
}
const alive=Object.values(w.rats).filter(r=>r.deadAt===null).length;
assert(!w.extinct);assert(alive>0);
console.log('PASS production-resolution 30d seed',CONFIG.colony.seed,'alive',alive,'deaths',w.totals.deaths,'food',w.env.food.toFixed(3),'warmth',w.env.warmth.toFixed(3));
