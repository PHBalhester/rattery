import assert from 'node:assert/strict';
import {lateralRoutes,toyApproaches,wheelToys} from '../src/sim/habitatLayout';
import {clearPath,findPath,safeGuide} from '../src/sim/navigation';
import {CONFIG} from '../src/config';
assert.equal(CONFIG.colony.maxAlive,80);assert.equal(CONFIG.colony.burrowWidth*CONFIG.colony.burrowHeight,2073600);
assert.equal(toyApproaches.filter(a=>wheelToys.has(a.toy)).length,2);
for(const route of lateralRoutes){for(let i=1;i<route.length;i++){let a=safeGuide({x:route[i-1].x,y:route[i-1].z}),b=safeGuide({x:route[i].x,y:route[i].z});const path=findPath(a,b);assert(path,'Lateral checkpoint disconnected');for(const next of path){assert(clearPath(a,next),'Detour intersects obstacle');a=next;}assert(Math.hypot(a.x-b.x,a.y-b.y)<1e-6);}assert(findPath({x:route[0].x,y:route[0].z},{x:route[80].x,y:route[80].z}));}
console.log('PASS: 44% expansion, unchanged population cap, two wheel approaches, all lateral segments navigable');
