import assert from 'node:assert/strict';
import {habitatRoutes,refugeWalls} from '../src/sim/habitatLayout';
import {walkable,clearPath,findPath,advance} from '../src/sim/navigation';
import {movementSpeed} from '../src/sim/movementSpeed';
import {createWorld} from '../src/sim/colony';
for(const wall of refugeWalls){assert(!walkable(wall));assert(!clearPath({x:wall.x-55,y:wall.y},{x:wall.x+55,y:wall.y}));}
for(const route of habitatRoutes){const c=route[81];for(const sign of [-1,1]){let p={x:c.x,y:c.z};const goal={x:c.x+sign*56,y:c.z};const path=findPath(p,goal);assert(path);let steps=0;while(path.length){const q=advance(p,path,4.1);assert(clearPath(p,q));assert(Math.hypot(q.x-p.x,q.y-p.y)<=4.100001);p=q;assert(++steps<500);}assert(Math.hypot(p.x-goal.x,p.y-goal.y)<1e-6);}}
const w=createWorld(9),rat=Object.values(w.rats)[0];rat.energy=1;rat.injury=0;rat.pregnant=null;rat.stage='adult';w.env.forage=0;w.env.panic=0;
const base=movementSpeed(rat,w);assert(base>2.4&&base<2.8);assert.equal(movementSpeed(rat,w),base);
rat.energy=.1;assert(movementSpeed(rat,w)<base*.5);rat.energy=1;rat.injury=.7;assert(movementSpeed(rat,w)<base*.6);rat.injury=0;
w.env.forage=1;assert(movementSpeed(rat,w)>base);w.env.panic=1;assert(movementSpeed(rat,w)<=base*1.5);assert(movementSpeed(rat,w)>base*1.4);
console.log('PASS: ten refuge walls, ten full shelter detours at fast pace, base speed and fatigue/injury/forage/panic modifiers');
