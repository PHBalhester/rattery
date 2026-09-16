import assert from 'node:assert/strict';
import {createWorld,NEST_POS} from '../src/sim/colony';
import {applyHabitatActivity} from '../src/sim/habitatActivity';
import {movementSpeed} from '../src/sim/movementSpeed';
import {clearPath} from '../src/sim/navigation';
import {habitatRoutes} from '../src/sim/habitatLayout';
const w=createWorld(9),r=Object.values(w.rats)[0];r.x=NEST_POS.x;r.y=NEST_POS.y;r.pregnant=null;r.nursing=[];r.energy=1;w.env.panic=0;
let far=0,returned=false;
for(let i=0;i<6000;i++){const before={x:r.x,y:r.y};w.simDay+=.001;applyHabitatActivity(w);assert(Math.hypot(r.x-before.x,r.y-before.y)<=movementSpeed(r,w)+1e-6);assert(clearPath(before,r));far=Math.max(far,Math.hypot(r.x-NEST_POS.x,r.y-NEST_POS.y));if(far>200&&Math.hypot(r.x-NEST_POS.x,r.y-NEST_POS.y)<2)returned=true;}
assert(far>200&&returned);
r.socialAction={kind:'groom',partner:'test',until:w.simDay+1};applyHabitatActivity(w);const p=habitatRoutes[2][50];r.x=p.x;r.y=p.z;delete r.socialAction;const before={x:r.x,y:r.y};applyHabitatActivity(w);assert(Math.hypot(r.x-before.x,r.y-before.y)<=movementSpeed(r,w)+1e-6);assert(clearPath(before,r));
const clone=JSON.parse(JSON.stringify(w));for(let i=0;i<50;i++){w.simDay+=.001;clone.simDay+=.001;applyHabitatActivity(w);applyHabitatActivity(clone);}assert.deepEqual(w,clone);
w.env.panic=1;for(let i=0;i<2000;i++){w.simDay+=.001;applyHabitatActivity(w);}assert(r.inNest && Math.hypot(r.vx,r.vy)<1e-6);
console.log('PASS: continuous exploration, completed return, social interruption, snapshot, panic shelter');
