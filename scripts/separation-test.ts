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
