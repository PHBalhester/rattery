import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {createWorld} from '../src/sim/colony';
import {tick} from '../src/sim/tick';
import {worldRng} from '../src/sim/rng';
import {applyTrade,restingStress} from '../src/sim/marketMap';
import {ecologyStep,zones,individualStress} from '../src/sim/ecology';
import {CONFIG} from '../src/config';
import type {World} from '../src/types';
const dt=CONFIG.time.tickMs/CONFIG.time.realMsPerSimDay,epoch=1800000000000,results:any[]=[];
function validate(w:World){const living=Object.values(w.rats).filter(r=>r.deadAt===null);assert(living.length<=CONFIG.colony.maxAlive);for(const v of [w.env.food,w.env.water,w.env.warmth,w.env.stress])assert(Number.isFinite(v)&&v>=0&&v<=1);for(const r of living){for(const v of [r.x,r.y,r.vx,r.vy])assert(Number.isFinite(v));for(const v of [r.energy,r.wellbeing?.hydration??1,r.wellbeing?.isolationDistress??0])assert(Number.isFinite(v)&&v>=0&&v<=1);}return living;}
for(const mode of ['quiet','buys','sells'] as const){const w=createWorld(42);w.realStartedAt=epoch;w.env.lastTradeAt=epoch;let firstDeath:number|null=null,peak=4,replay:World|undefined;const rng=worldRng(w);for(let i=0;i<36000;i++){
 if(mode!=='quiet'&&i%600===0){const trade={id:`${mode}-${i}`,ts:epoch+i*100,side:mode==='buys'?'buy' as const:'sell' as const,usd:1200,eth:1,tokens:1,trader:'fixture',isNewHolder:false};w.env=applyTrade(w.env,trade);if(replay)replay.env=applyTrade(replay.env,trade);}
 tick(w,dt,rng);if(i===6000)replay=structuredClone(w);else if(replay&&i<=6600){tick(replay,dt,worldRng(replay));if(i===6600){assert.deepEqual(w,replay,'resume must match uninterrupted world');replay=undefined;}}
 if(i%600===599){const living=validate(w);peak=Math.max(peak,living.length);if(w.totals.deaths&&firstDeath===null)firstDeath=w.simDay;if(i%9000===8999)console.log(mode+' day '+Math.round(w.simDay)+' / alive '+living.length);}
 }results.push({mode,days:w.simDay,alive:validate(w).length,births:w.totals.pups,deaths:w.totals.deaths,peak,firstDeath,food:w.env.food,water:w.env.water,warmth:w.env.warmth,restingTarget:restingStress(w.env),stress:w.env.stress});}
assert(results[0].firstDeath===null||results[0].firstDeath>20,'no early quiet collapse');assert(results[1].food>results[0].food);// Purchases also add warmth: overheated buy scenarios are not a valid calm control.
assert(results[2].stress>results[2].restingTarget,'sale alarm persists above its resource baseline');
function crowded(spread:boolean){const w=createWorld(9),base=Object.values(w.rats)[0];w.rats={};for(let i=0;i<80;i++){const z=zones[spread?i%zones.length:0];w.rats['r'+i]={...structuredClone(base),id:'r'+i,x:z.x,y:z.y};}for(let i=0;i<1000;i++){w.simDay+=.01;ecologyStep(w,.01);}validate(w);return Object.values(w.rats).reduce((s,r)=>s+individualStress(r,0),0)/80;}
const packed=crowded(false),distributed=crowded(true);assert(packed>distributed);results.push({packedStress:packed,distributedStress:distributed});mkdirSync('test-results',{recursive:true});writeFileSync('test-results/calibration-soak.json',JSON.stringify(results,null,2));console.log(JSON.stringify(results,null,2));console.log('PASS: 180 simulated days, checkpoint replay, resource/position bounds, population cap, packed/distributed crowding');
