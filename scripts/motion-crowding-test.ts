import assert from 'node:assert/strict';
import {createWorld,NEST_POS} from '../src/sim/colony';
import {applyHabitatActivity} from '../src/sim/habitatActivity';
import {separateRats} from '../src/sim/separation';
import {physique} from '../src/sim/physique';
import {walkable} from '../src/sim/navigation';
const sizes=Array.from({length:100},(_,i)=>physique('rat-'+i));assert(sizes.every(s=>s>=.88&&s<=1.12));assert(Math.max(...sizes)-Math.min(...sizes)>.15);assert.equal(physique('F1'),physique('F1'));
const founders=['F1','F2','M1','M2'].map(physique);assert(Math.max(...founders)-Math.min(...founders)>.05);
for(const population of [4,12]){
const world=createWorld();const template=Object.values(world.rats)[0];for(let i=4;i<population;i++){const rat=structuredClone(template);rat.id='crowd-'+i;world.rats[rat.id]=rat;}
for(const r of Object.values(world.rats)){r.x=NEST_POS.x;r.y=NEST_POS.y;r.energy=.9;r.socialAction=undefined;r.pregnant=null;r.nursing=[];if(r.wellbeing)r.wellbeing.hydration=1;r.exploration={route:0,waypoint:0,restUntil:0};}
world.env.panic=0;const escaped=new Set<string>();
for(let i=0;i<1000;i++){world.simDay+=.0001;applyHabitatActivity(world);const before=Object.fromEntries(Object.values(world.rats).map(r=>[r.id,{x:r.x,y:r.y}]));separateRats(world);for(const r of Object.values(world.rats)){if(Math.hypot(r.x-NEST_POS.x,r.y-NEST_POS.y)>100&&(r.exploration?.waypoint??0)>1)escaped.add(r.id);assert(walkable(r));assert(Math.hypot(r.x-before[r.id].x,r.y-before[r.id].y)<=3.00001);}}
for(const r of Object.values(world.rats))assert(escaped.has(r.id),`never left center: ${r.id}, population ${population}`);
}
console.log('PASS: stable size variation, 4 and 12 clustered rats with the same initial route leave the center, bounded corrections and walkable positions');
