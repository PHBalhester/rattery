import assert from 'node:assert/strict';
import {createWorld} from '../src/sim/colony';
import {applyHabitatActivity} from '../src/sim/habitatActivity';
import {toyApproaches} from '../src/sim/habitatLayout';
import {playActivity} from '../src/sim/playActivity';
const w=createWorld(9),rs=Object.values(w.rats);const target=toyApproaches.find(t=>t.toy===1)!.contact;
for(const r of rs){r.pregnant=null;r.nursing=[];r.energy=1;r.x=target.x;r.y=target.z;r.exploration={route:1,waypoint:0,restUntil:0,playingUntil:1};}w.env.panic=0;
applyHabitatActivity(w);assert.equal([...playActivity.values()].filter(p=>p.kind==='wheel').length,1);
const actor=rs.find(r=>playActivity.has(r.id))!;actor.socialAction={kind:'groom',partner:rs.find(r=>r!==actor)!.id,until:1};applyHabitatActivity(w);assert(!playActivity.has(actor.id));assert.equal(actor.exploration!.playingUntil,w.simDay);
delete actor.socialAction;actor.exploration!.playingUntil=1;actor.x+=100;applyHabitatActivity(w);assert(!playActivity.has(actor.id));
for(const r of rs){r.x=target.x;r.y=target.z;r.exploration!.playingUntil=1;}w.env.panic=1;applyHabitatActivity(w);assert.equal(playActivity.size,0);
for(const r of rs){r.x=800;r.y=520;r.energy=1;r.socialAction=null;r.retrieving=null;r.nursing=[];r.pregnant=null;r.wellbeing={acute:.1,chronic:.1,hydration:1,lastWater:0,cause:'calm',support:0,crowding:0,zone:0};r.exploration={route:0,waypoint:0,restUntil:0,denCooldown:0};}
w.env.panic=0;w.careProtection={active:true,until:Date.now()+3600000};applyHabitatActivity(w);assert(rs.every(r=>r.exploration?.den===undefined));
console.log('PASS: exclusive wheel, social interruption, no remote playback, panic cancellation, protected adults remain active');
