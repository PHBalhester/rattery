import assert from 'node:assert/strict';
import {createWorld} from '../src/sim/colony';
import {platformPaths,platformHeight,toyApproaches,diggingToy} from '../src/sim/habitatLayout';
import {clearPath} from '../src/sim/navigation';
import {ecologyStep} from '../src/sim/ecology';
import {compareHabitats} from '../src/sim/habitatComparison';
for(const platform of platformPaths){const [a,b,c]=platform.points;assert.equal(platformHeight(a.x,a.z),0);assert(Math.abs(platformHeight(b.x,b.z)-18)<1e-8);assert(Math.abs(platformHeight(c.x,c.z))<1e-8);for(const [start,end] of [[a,b],[b,c]]){let prev=platformHeight(start.x,start.z);for(let i=1;i<=100;i++){const p=start.clone().lerp(end,i/100),height=platformHeight(p.x,p.z);assert(height>=0&&height<=18);assert(Math.abs(height-prev)<1);prev=height;}assert(clearPath({x:start.x,y:start.z},{x:end.x,y:end.z}));}}
assert(toyApproaches.some(a=>a.toy===diggingToy));
const w=createWorld(9),r=Object.values(w.rats)[0];r.energy=.6;r.exploration={route:diggingToy,waypoint:0,restUntil:0,playingUntil:1};w.env.food=1;ecologyStep(w,.01);assert(r.energy>.6);
const basic=JSON.parse(JSON.stringify(w));basic.habitatMode='basic';basic.rats[r.id].energy=.6;ecologyStep(basic,.01);assert(basic.rats[r.id].energy<=.6);
const original=JSON.stringify(w),one=compareHabitats(w,80),two=compareHabitats(w,80);assert.deepEqual(one,two);assert.equal(JSON.stringify(w),original);assert.equal(one.results.length,2);
console.log('PASS: continuous ramps, accessible digging, bounded reward, basic disables play, reproducible isolated comparison');
