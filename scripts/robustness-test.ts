import assert from 'node:assert/strict';
import {CONFIG} from '../src/config';
import {createWorld} from '../src/sim/colony';
import {worldRng} from '../src/sim/rng';
import {tick} from '../src/sim/tick';
import {applyTrade} from '../src/sim/marketMap';
import {colonyMetrics} from '../src/sim/colonyMetrics';
import {habitatRoutes,obstacles,toyApproaches} from '../src/sim/habitatLayout';
import type {Trade,World} from '../src/types';

const dt=CONFIG.time.tickMs/CONFIG.time.realMsPerSimDay;
const bounded=(n:number,label:string)=>{assert(Number.isFinite(n),`${label} is non-finite`);assert(n>=0&&n<=1,`${label}=${n} outside 0..1`)};
function trade(i:number,side:'buy'|'sell',usd:number):Trade{return{id:`t${i}`,ts:1700000000000+i*1000,side,eth:usd/2400,usd,tokens:usd*10,trader:`0x${(i%17).toString(16).padStart(40,'0')}`,isNewHolder:i%17===0,venue:'demo'}}
function validate(w:World,label:string){
 assert(w.simDay>=0&&Number.isFinite(w.simDay));assert(Object.values(w.rats).filter(r=>r.deadAt===null).length<=CONFIG.colony.maxAlive,`${label}: living population cap`);
 for(const k of ['food','warmth','water','stress','dopaminePulse','buyPressure','sellPressure','forage','panic'] as const)bounded(w.env[k],`${label}.env.${k}`);
 for(const r of Object.values(w.rats)){
  for(const [k,v] of Object.entries({x:r.x,y:r.y,vx:r.vx,vy:r.vy,energy:r.energy,heat:r.heat}))assert(Number.isFinite(v),`${label}.${r.id}.${k}`);
  bounded(r.energy,`${r.id}.energy`);bounded(r.heat,`${r.id}.heat`);assert(r.x>=0&&r.x<=CONFIG.colony.burrowWidth,`${r.id}.x=${r.x}`);assert(r.y>=0&&r.y<=CONFIG.colony.burrowHeight,`${r.id}.y=${r.y}`);
  for(const [k,v] of Object.entries(r.hormones))bounded(v,`${r.id}.hormones.${k}`);
  assert(new Set(r.nursing).size===r.nursing.length,`${r.id}: duplicate nursing id`);assert(!r.nursing.includes(r.id),`${r.id}: nurses self`);
  if(r.pregnant){assert(r.sex==='F'&&r.stage==='adult');assert(r.pregnant.dueAt>r.pregnant.conceivedAt);assert(r.pregnant.plannedLitter>=0)}
 }
 const m=colonyMetrics(w);for(const [k,v] of Object.entries(m))if(typeof v==='number')assert(Number.isFinite(v),`${label}.metric.${k}`);
 for(const k of ['density','crowdPressure','cohesion','isolation','nest','hunger','thirst','cold','hot','stress'] as const)bounded(m[k],`${label}.metric.${k}`);
}
const scenarios={silence:(i:number)=>null,buys:(i:number)=>i%20===0?trade(i,'buy',i%200===0?1e9:50):null,sells:(i:number)=>i%20===0?trade(i,'sell',i%200===0?1e9:50):null,volatile:(i:number)=>i%13===0?trade(i,i%26===0?'buy':'sell',10**((i%7)+1)):null,shock:(i:number)=>i%1000===0?trade(i,(i/1000)%2?'sell':'buy',1e12):null};
let ticks=0;
for(const [name,event] of Object.entries(scenarios))for(let seed=1;seed<=6;seed++){
 if(process.env.RATTERY_TEST_SEED&&seed!==Number(process.env.RATTERY_TEST_SEED))continue;
 const w=createWorld(seed),rng=worldRng(w);for(let i=0;i<120000;i++){const t=event(i);if(t)w.env=applyTrade(w.env,t);tick(w,dt,rng);if(i%5000===0)validate(w,`${name}/seed${seed}/tick${i}`);ticks++;}validate(w,`${name}/seed${seed}/final`);console.log(`PASS ${name} seed ${seed}: ${ticks} ticks`);
}
assert.equal(habitatRoutes.length,5);for(const route of habitatRoutes)for(const p of route){assert(p.x>=0&&p.x<=CONFIG.colony.burrowWidth);assert(p.z>=0&&p.z<=CONFIG.colony.burrowHeight)}
assert(obstacles.length>=5);assert(obstacles.every(o=>o.clearance>65));assert(toyApproaches.length===obstacles.length);
console.log(JSON.stringify({scenarios:Object.keys(scenarios),seeds:6,ticks,simDaysPerRun:120000*dt,routes:habitatRoutes.length,obstacles:obstacles.length,minClearance:Math.min(...obstacles.map(o=>o.clearance))}));
