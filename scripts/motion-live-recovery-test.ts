import assert from 'node:assert/strict';
import fs from 'node:fs';
import {tick} from '../src/sim/tick';
import {worldRng} from '../src/sim/rng';
import {CONFIG} from '../src/config';
import type {World} from '../src/types';
const input=process.argv[2];assert(input,'private snapshot path required');
const initial=JSON.parse(fs.readFileSync(input,'utf8')) as World;
const run=()=>{
 const w=structuredClone(initial);
 const ids=w.permanentCore!.ratIds;
 const starts=Object.fromEntries(ids.map(id=>[id,{x:w.rats[id].x,y:w.rats[id].y,waypoint:w.rats[id].exploration!.waypoint,route:w.rats[id].exploration!.route}]));
 const distances=Object.fromEntries(ids.map(id=>[id,0]));
 const progressed=new Set<string>();
 for(let i=0;i<3000;i++){
  tick(w,CONFIG.time.simDaysPerTick,worldRng(w),undefined,Math.max(initial.careProtection?.until??0,0)+100000+i*100);
  for(const id of ids){const r=w.rats[id],s=starts[id];assert.equal(r.deadAt,null);distances[id]=Math.max(distances[id],Math.hypot(r.x-s.x,r.y-s.y));if(r.exploration!.route!==s.route||r.exploration!.waypoint!==s.waypoint)progressed.add(id);}
 }
 for(const id of ids){assert(progressed.has(id),'route stalled: '+id);assert(distances[id]>100,'position stalled: '+id+' '+distances[id]);}
 return {w,distances};
};
const a=run(),b=run();assert.deepEqual(a,b);console.log(JSON.stringify(a.distances));console.log('PASS: all core residents advance routes and travel >100 units over five minutes; deterministic replay and survival.');
