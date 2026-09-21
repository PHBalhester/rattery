import assert from 'node:assert/strict';
import {createWorld,NEST_POS} from '../src/sim/colony';
import {applyHabitatActivity} from '../src/sim/habitatActivity';
import {ecologyStep} from '../src/sim/ecology';
import {colonyAlerts} from '../src/render/colonyAlerts';
const w=createWorld(),r=Object.values(w.rats)[0];w.rats={[r.id]:r};r.x=NEST_POS.x;r.y=NEST_POS.y;r.energy=1;w.env.water=1;
ecologyStep(w,0);r.wellbeing!.hydration=.55;
applyHabitatActivity(w);assert.equal(r.exploration!.waterZone,0);
r.wellbeing!.hydration=.65;applyHabitatActivity(w);assert.equal(r.exploration!.waterZone,0,'must not abandon water above trigger');
const restored=JSON.parse(JSON.stringify(w));applyHabitatActivity(w);applyHabitatActivity(restored);assert.deepEqual(w,restored);
r.wellbeing!.hydration=.85;applyHabitatActivity(w);assert.equal(r.exploration!.waterZone,undefined);
r.wellbeing!.hydration=.35;assert.equal(colonyAlerts(w).find(a=>a.key==='dehydrated')?.critical,false);
r.wellbeing!.hydration=.15;assert.equal(colonyAlerts(w).find(a=>a.key==='dehydrated')?.critical,true);
r.nursing=['pup'];r.wellbeing!.hydration=.3;applyHabitatActivity(w);assert.equal(r.exploration!.waterZone,0);
console.log('PASS early water seeking, stable destination, drink to 85%, JSON resume, maternal nest and severity thresholds');

// A social/separation displacement must invalidate a completed water path.
r.nursing=[];r.x=NEST_POS.x;r.y=NEST_POS.y+82;r.wellbeing!.hydration=.1;
r.exploration!.waterZone=0;r.exploration!.target='resource:0';r.exploration!.path=[];
const before=Math.hypot(r.x-NEST_POS.x,r.y-NEST_POS.y);applyHabitatActivity(w);
assert((r.exploration!.path?.length??0)>0||Math.hypot(r.x-NEST_POS.x,r.y-NEST_POS.y)<before);
console.log('PASS displaced rat rebuilds completed water route');


// A crowded thirsty colony must reserve multiple reachable water points.
const crowded=createWorld(),template=structuredClone(Object.values(crowded.rats)[0]);crowded.rats={};
for(let i=0;i<82;i++){const q=structuredClone(template);q.id='water-'+i;q.x=NEST_POS.x;q.y=NEST_POS.y;q.stage='adult';q.pregnant=null;q.nursing=[];q.retrieving=undefined;q.socialAction=undefined;q.wellbeing={acute:1,chronic:1,hydration:.1,lastWater:0,cause:'thirst',support:0,crowding:0,zone:0};q.exploration={route:i%6,waypoint:0,restUntil:0};crowded.rats[q.id]=q;}
applyHabitatActivity(crowded);
const reservations=Object.values(crowded.rats).reduce((m,q)=>m.set(q.exploration!.waterZone,(m.get(q.exploration!.waterZone)??0)+1),new Map<number|undefined,number>());
assert([...reservations.keys()].filter(v=>v!==undefined).length>=5,'thirsty crowd must use at least five water points');
assert(Math.max(...reservations.values())<=20,'no water point may receive the whole crowd');
console.log('PASS crowded thirsty residents reserve distributed water points',Object.fromEntries(reservations));
