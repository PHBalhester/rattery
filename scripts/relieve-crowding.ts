import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {aliveRats,kill} from '../src/sim/colony';
import type {World} from '../src/types';
// Offline transform only; the operator must hold the database row lock and archive the input.
const world=JSON.parse(readFileSync(0,'utf8')) as World;
const care=JSON.stringify(world.care),before=aliveRats(world).length,selected:string[]=[];
for(let i=0;i<6 && aliveRats(world).length>90;i++){
 const adults=aliveRats(world).filter(r=>r.stage==='adult');
 const eligible=adults.filter(r=>!r.pregnant&&!r.nursing.length&&!r.retrieving&&adults.filter(a=>a.sex===r.sex).length>2)
 .sort((a,b)=>a.bornAt-b.bornAt||a.id.localeCompare(b.id));
 if(!eligible.length)break;
 selected.push(eligible[0].id);kill(world,eligible[0],'crowding');
}
assert.equal(JSON.stringify(world.care),care);
assert.equal(aliveRats(world).length,before-selected.length);
for(const id of selected)assert.equal(world.memorial?.[id]?.deathCause,'crowding');
process.stdout.write(JSON.stringify({world,selected,before,after:aliveRats(world).length}));
