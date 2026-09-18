import assert from 'node:assert/strict';
import {createWorld,NEST_POS} from '../src/sim/colony';
import {applyHabitatActivity} from '../src/sim/habitatActivity';
const w=createWorld(),base=Object.values(w.rats)[0];w.rats={};
for(let i=0;i<13;i++){const r=structuredClone(base);r.id='test'+i;r.x=NEST_POS.x+(i%4)*8;r.y=NEST_POS.y+Math.floor(i/4)*8;r.energy=.9;r.pregnant=null;r.nursing=[];delete r.exploration;w.rats[r.id]=r;}
w.rats.test0.nursing=['pup'];
applyHabitatActivity(w);
assert.equal(w.rats.test0.exploration?.den,undefined);
const departing=Object.values(w.rats).filter(r=>r.exploration?.den!==undefined);assert.equal(departing.length,1);
applyHabitatActivity(w);assert.equal(Object.values(w.rats).filter(r=>r.exploration?.den!==undefined).length,1);
console.log('PASS: 13/18 nest sends one eligible adult; nursing mother stays; reservations prevent repeated over-dispatch');
