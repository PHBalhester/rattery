import assert from 'node:assert/strict';
import {createWorld,NEST_POS} from '../src/sim/colony';
import {separateRats,separationDistance} from '../src/sim/separation';
import {walkable} from '../src/sim/navigation';
const world=createWorld(),rats=Object.values(world.rats);
for(const r of rats){r.x=NEST_POS.x;r.y=NEST_POS.y;r.stage='adult';}
const clone=structuredClone(world),seed=world.rngState;
for(let i=0;i<60;i++){separateRats(world);separateRats(clone);}
assert.deepEqual(world,clone);assert.equal(world.rngState,seed);
for(let i=0;i<rats.length;i++){assert(walkable(rats[i]));for(let j=i+1;j<rats.length;j++)assert(Math.hypot(rats[i].x-rats[j].x,rats[i].y-rats[j].y)>=separationDistance(rats[i],rats[j])-.2);}
const pair=createWorld();const [a,b]=Object.values(pair.rats);for(const r of Object.values(pair.rats))if(r!==a&&r!==b)r.deadAt=0;
a.x=b.x=NEST_POS.x;a.y=b.y=NEST_POS.y;a.socialAction={kind:'courtship',partner:b.id,until:3};b.socialAction={kind:'courtship',partner:a.id,until:3};
for(let i=0;i<20;i++)separateRats(pair);
const d=Math.hypot(a.x-b.x,a.y-b.y);assert(d>=17.9&&d<=20);assert(a.socialAction);
console.log('PASS: central overlap resolves, walkable, deterministic, RNG unchanged, social contact preserved');


// Opposing walkers must pass each other instead of having every forward step
// cancelled by positional separation.
const crossing=createWorld();
const [left,right]=Object.values(crossing.rats);
for(const r of Object.values(crossing.rats))if(r!==left&&r!==right)r.deadAt=0;
for(const [r,offset] of [[left,-30],[right,30]] as const){
 r.x=800+offset;r.y=730;r.stage='adult';delete r.socialAction;
}
const targets=new Map([[left,{x:800+65,y:730}],[right,{x:800-65,y:730}]]);
for(let t=0;t<100;t++){
 for(const r of [left,right]){
  const target=targets.get(r)!,dx=target.x-r.x,dy=target.y-r.y,d=Math.hypot(dx,dy),f=Math.min(1,2.6/(d||1));
  r.vx=dx*f;r.vy=dy*f;r.x+=r.vx;r.y+=r.vy;
 }
 const before=[left,right].map(r=>({x:r.x,y:r.y}));
 separateRats(crossing);
 for(const [i,r] of [left,right].entries()){
  assert(walkable(r));assert(Math.hypot(r.x-before[i].x,r.y-before[i].y)<=3.00001);
 }
}
assert(left.x>800+45&&right.x<800-45,'opposing walkers remain blocked');
console.log('PASS: opposing walkers pass with bounded, walkable separation');
