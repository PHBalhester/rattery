import assert from 'node:assert/strict';
import {habitatRoutes,lateralRoutes,toyApproaches,obstacles,refugeBlocked} from '../src/sim/habitatLayout';
import {NEST_POS} from '../src/sim/colony';
import {walkable} from '../src/sim/navigation';
const paths=[...habitatRoutes,...lateralRoutes,...toyApproaches.map(t=>[t.anchor,t.contact])];
function reference(x:number,y:number){return !refugeBlocked({x,y})&&obstacles.every(o=>Math.hypot(x-o.p.x,y-o.p.z)>=35)&&(Math.hypot(x-NEST_POS.x,y-NEST_POS.y)<=NEST_POS.r-10||habitatRoutes.some(r=>Math.hypot(x-r[81].x,y-r[81].z)<=62)||paths.some(path=>path.slice(1).some((b,i)=>{const a=path[i],dx=b.x-a.x,dy=b.z-a.z,t=Math.max(0,Math.min(1,((x-a.x)*dx+(y-a.z)*dy)/(dx*dx+dy*dy||1)));return Math.hypot(x-a.x-dx*t,y-a.z-dy*t)<=12;})));}
let seed=7;const rng=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
for(let i=0;i<15000;i++){const x=rng()*2100-50,y=rng()*1200-50;assert.equal(walkable({x,y}),reference(x,y));}
for(const path of paths)for(const p of path)assert.equal(walkable({x:p.x,y:p.z}),reference(p.x,p.z));
console.log('PASS: indexed navigation matches original scan at 15000 random points and every waypoint');
