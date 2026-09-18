import assert from 'node:assert/strict';
import {emptyEnv,restingStress,decayEnv,applyTrade} from '../src/sim/marketMap';
const healthy={...emptyEnv(),food:1,water:1,warmth:.6,stress:.8};
assert.equal(restingStress(healthy),.12);
let recovered=healthy;for(let i=0;i<3000;i++)recovered=decayEnv(recovered,.1);
assert(recovered.stress<.155&&recovered.stress>.12,'calm recovery over five simulated days');
const shortage={...healthy,food:.05,water:.05,warmth:.08,stress:.12};assert(restingStress(shortage)>.6);assert(decayEnv(shortage,60).stress>shortage.stress);
assert(restingStress({...healthy,warmth:.98})>restingStress(healthy));
const direct=decayEnv(healthy,10);let split=healthy;for(let i=0;i<100;i++)split=decayEnv(split,.1);assert(Math.abs(split.stress-direct.stress)<1e-12);
const sale=applyTrade({...healthy,stress:.2},{id:'sale',ts:1800000000000,side:'sell',usd:1200,eth:1,tokens:0,trader:'fixture',isNewHolder:false});assert(sale.stress>.2&&sale.panic>0);assert(sale.socialSignals?.includes('sell'));
for(const dt of [0,-1,NaN,Infinity])assert.deepEqual(decayEnv(healthy,dt),healthy);
for(const dt of [.001,.1,1,60,3600]){const s=decayEnv(healthy,dt).stress;assert(s>=.12&&s<=healthy.stress)}
console.log('PASS: calm target, gradual recovery, scarcity/temperature response, timestep equivalence, giant-sale reactions, invalid dt and no overshoot');
