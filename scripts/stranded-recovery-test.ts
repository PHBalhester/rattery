import assert from 'node:assert/strict';
import {recoverPosition,walkable,findPath} from '../src/sim/navigation';
import {createWorld} from '../src/sim/colony';
import {applyHabitatActivity} from '../src/sim/habitatActivity';
import {ecologyStep,zones} from '../src/sim/ecology';
const positions=[{x:165.17515884388473,y:633.9263092333388},{x:208.8507158640001,y:256.61678523787737},{x:689.0109982219032,y:498.7140339565598},{x:1418.1486158937737,y:620.8023795483426},{x:749.2703083688828,y:616.849053704103},{x:754.8485934619268,y:385.7186835614558}];
for(const pos of positions){
 const repaired=recoverPosition(pos,1);assert(repaired);assert(walkable(repaired));assert(Math.hypot(pos.x-repaired.x,pos.y-repaired.y)<=60);assert(findPath(repaired,zones[0]));assert.deepEqual(recoverPosition(pos,1),repaired);
 const w=createWorld(),r=Object.values(w.rats)[0];w.rats={[r.id]:r};Object.assign(r,pos);r.nursing=[];r.pregnant=null;r.stage='adult';w.env.water=1;
 ecologyStep(w,0);r.wellbeing!.hydration=0;
 for(let i=0;i<2400;i++){w.simDay+=1/600;applyHabitatActivity(w);ecologyStep(w,1/600);}
 assert(r.wellbeing!.hydration>.6,'recovered resident must drink');
}
assert.equal(recoverPosition({x:-9999,y:-9999},1),null);
assert.equal(recoverPosition(zones[0],1),null);
console.log('PASS six stranded positions: bounded deterministic repair, connected water route and hydration recovery');
