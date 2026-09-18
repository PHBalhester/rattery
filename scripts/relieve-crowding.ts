import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {aliveRats,kill} from '../src/sim/colony';
import type {World} from '../src/types';
// Offline transform only; the operator must hold the database row lock and archive the input.
const world=JSON.parse(readFileSync(0,'utf8')) as World;
const care=JSON.stringify(world.care),before=aliveRats(world).length,selected:string[]=[];
const limit=Number(process.argv[2]??6),floor=Number(process.argv[3]??90);
const includeIndependentYoung=process.argv[4]==='independent-young';
assert.ok(Number.isInteger(limit)&&limit>=1&&limit<=40);
assert.ok(Number.isInteger(floor)&&floor>=70);
for(let i=0;i<limit && aliveRats(world).length>floor;i++){
 const living=aliveRats(world),adults=living.filter(r=>r.stage==='adult');
 const dependent=new Set(living.flatMap(r=>r.nursing));
 const minted=(r:typeof living[number])=>Boolean(r.minted||world.care?.owners[r.id]);
 const eligible=living.filter(r=>(r.stage==='adult'||(includeIndependentYoung&&r.stage==='weanling'))&&!dependent.has(r.id)&&!r.pregnant&&!r.nursing.length&&!r.retrieving&&(r.stage!=='adult'||adults.filter(a=>a.sex===r.sex).length>2))
 .sort((a,b)=>Number(minted(a))-Number(minted(b))||a.bornAt-b.bornAt||a.id.localeCompare(b.id));
 if(!eligible.length)break;
 selected.push(eligible[0].id);kill(world,eligible[0],'crowding');
}
assert.equal(JSON.stringify(world.care),care);
assert.equal(aliveRats(world).length,before-selected.length);
for(const id of selected)assert.equal(world.memorial?.[id]?.deathCause,'crowding');
process.stdout.write(JSON.stringify({world,selected,before,after:aliveRats(world).length}));
