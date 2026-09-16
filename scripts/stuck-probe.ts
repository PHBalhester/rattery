import assert from 'node:assert/strict';
import {createWorld} from '../src/sim/colony';
import {applyHabitatActivity} from '../src/sim/habitatActivity';
import {separateRats} from '../src/sim/separation';
import {recoverPosition,walkable} from '../src/sim/navigation';
import {refugeWalls} from '../src/sim/habitatLayout';
for(const wall of refugeWalls)assert.equal(recoverPosition(wall,2.6),null);
const w=createWorld();w.env.panic=0;const last=new Map<string,{x:number;y:number;still:number}>();
const recovered=new Set<string>();
for(let i=0;i<8000;i++){
 w.simDay+=.001;applyHabitatActivity(w);separateRats(w);
 for(const r of Object.values(w.rats)){
  if(walkable(r))recovered.add(r.id);
  const old=last.get(r.id),still=old&&Math.hypot(r.x-old.x,r.y-old.y)<.001?old.still+1:0;
  last.set(r.id,{x:r.x,y:r.y,still});
  if(still===150&&w.simDay>(r.exploration?.restUntil??0))throw Error('Blocked route '+r.id+' '+r.exploration?.waypoint);
 }
}
assert.equal(recovered.size,Object.keys(w.rats).length);
console.log('PASS: 8000 ticks from actual founder positions without unintended stalls; recovery cannot cross shelter walls');
