import assert from 'node:assert/strict';
import {findPath,clearPath,advance,walkable} from '../src/sim/navigation';
import {habitatRoutes,obstacles,toyApproaches} from '../src/sim/habitatLayout';
const points=habitatRoutes.flatMap(r=>[r[20],r[60],r[85]]).map(p=>({x:p.x,y:p.z}));
let steps=0,detours=0;
for(const a of points)for(const b of points){let p={...a};const path=findPath(a,b);assert(path);if(!clearPath(a,b))detours++;const clone=JSON.parse(JSON.stringify(path));assert.deepEqual(advance(p,clone),advance(p,JSON.parse(JSON.stringify(path))));let count=0;while(path.length){const q=advance(p,path);assert(Math.hypot(q.x-p.x,q.y-p.y)<=1.200001);assert(clearPath(p,q),JSON.stringify({p,q,a,b}));p=q;steps++;assert(++count<10000);}assert(Math.hypot(p.x-b.x,p.y-b.y)<.001);}
for(const o of obstacles)assert(!walkable({x:o.p.x,y:o.p.z}));
for(const t of toyApproaches)assert(findPath({x:t.contact.x,y:t.contact.z},points[0]));
assert.equal(findPath({x:NaN,y:0},points[0]),null);assert.equal(findPath({x:-1000,y:-1000},points[0]),null);assert(detours>0);
console.log(`PASS: 225 routes, ${detours} detours, ${steps} bounded collision-checked steps, toys and invalid origins`);
