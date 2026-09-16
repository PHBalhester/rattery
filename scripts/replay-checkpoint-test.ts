import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {createWorld} from '../src/sim/colony';
import {worldRng} from '../src/sim/rng';
import {makeReplay,tagNewHolders} from '../src/sim/replay';
import type {Trade} from '../src/types';
const t0=1700000000000,targetTick=1200;
const opts={t0,targetTick,tickMs:100,dtDays:1/600,maxTicks:targetTick};
const trades:Trade[]=Array.from({length:500},(_,i)=>({id:'snapshot-'+i,ts:t0+Math.floor(i/4)*500,side:i%3?'buy':'sell',usd:i%4?250:1500,eth:1,tokens:1,trader:'wallet-'+i%13,venue:'curve',block:100+Math.floor(i/4),logIndex:i%4,isNewHolder:false}));tagNewHolders(trades);
const canonical=(w:any)=>JSON.stringify(w);
const key=(t:Trade)=>(t.block??0)*100000+(t.logIndex??0);
const checks:any[]=[];
for(const seed of [1,9,42]){
 const initial=createWorld(seed);initial.realStartedAt=t0;initial.env.lastTradeAt=t0;
 const full=structuredClone(initial),r=makeReplay(full,worldRng(full),trades,opts);while(!r.done())r.step(73);
 for(const cut of [0,1,5,10,250,999])for(const tailOnly of [false,true]){
  const partial=structuredClone(initial),a=makeReplay(partial,worldRng(partial),trades,{...opts,targetTick:cut});while(!a.done())a.step(17);
  const saved=JSON.parse(JSON.stringify({world:partial,cursor:a.cursor()}));
  const input=tailOnly?trades.filter(t=>key(t)>saved.cursor.lastKey):trades;
  const b=makeReplay(saved.world,worldRng(saved.world),input,{...opts,resume:saved.cursor});while(!b.done())b.step(29);
  assert.equal(canonical(saved.world),canonical(full),`seed ${seed}, cut ${cut}, tail ${tailOnly}`);assert.deepEqual(b.cursor(),r.cursor());checks.push({seed,cut,tailOnly});
 }
 let w=structuredClone(initial),cursor={tick:0,lastKey:-1};
 while(cursor.tick<targetTick){const b=makeReplay(w,worldRng(w),trades,{...opts,resume:cursor,maxTicks:50});while(!b.done())b.step(7);cursor=b.cursor();w=JSON.parse(JSON.stringify(w));}
 assert.equal(canonical(w),canonical(full));
}
const w=createWorld(1);
for(const bad of [NaN,Infinity,-1,1.5])assert.throws(()=>makeReplay(w,worldRng(w),trades,{...opts,targetTick:bad}),/Invalid/);
assert.throws(()=>makeReplay(w,worldRng(w),trades,{...opts,resume:{tick:100,lastKey:-1}}),/predates/);
assert.throws(()=>makeReplay(w,worldRng(w),trades,{...opts,resume:{tick:1201,lastKey:-1}}),/Invalid/);
assert.throws(()=>makeReplay(w,worldRng(w),trades,{...opts,resume:{tick:0,lastKey:NaN}}),/Invalid/);
const huge=makeReplay(w,worldRng(w),[],{...opts,targetTick:1_000_010,maxTicks:10,resume:{tick:1_000_000,lastKey:5}});assert.equal(huge.target,1_000_010);while(!huge.done())huge.step(10);assert.equal(huge.reached(),1_000_010);
writeFileSync('test-results/replay-checkpoints.json',JSON.stringify({checks,segmentedSeeds:3,invalidInputs:true,largeCursor:true,scope:'Core replay cursor with trusted JSON snapshots. No production snapshot service or identity verification yet.'},null,2));
console.log('PASS: 36 snapshot seams, 3 segmented replays, invalid timings, late trades and large cursors');
