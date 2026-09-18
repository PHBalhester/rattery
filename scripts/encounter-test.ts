import assert from 'node:assert/strict';
import {createWorld,NEST_POS} from '../src/sim/colony';
import {socialStep,pairKey} from '../src/sim/social';
import {encounterPose,ENCOUNTER_SECONDS} from '../src/sim/pairEncounter';
import {prepareDemoActivity} from '../src/sim/demoActivity';
import {applyHabitatActivity} from '../src/sim/habitatActivity';
import {playActivity} from '../src/sim/playActivity';
import {separateRats} from '../src/sim/separation';
import {clearPath} from '../src/sim/navigation';
const w=createWorld(9),rs=Object.values(w.rats),f=rs.find(r=>r.sex==='F')!,m=rs.find(r=>r.sex==='M')!;
w.social={affinities:{[pairKey(f,m)]:.9},cooldown:0,nextAmbient:99};
for(const r of rs){r.energy=1;r.pregnant=null;r.nursing=[];}
f.x=NEST_POS.x;f.y=NEST_POS.y;m.x=f.x-48;m.y=f.y;
w.env.socialSignals=['buy'];
for(let i=0;i<80&&!f.socialAction?.encounter;i++){w.simDay+=1/600;socialStep(w,1/600,()=>0);}
assert(f.socialAction?.encounter,'Must reserve a coordinated encounter');assert(!f.pregnant,'No conception before contact');
const saved=JSON.parse(JSON.stringify(w));
for(let i=0;i<180;i++){w.simDay+=1/600;saved.simDay+=1/600;socialStep(w,1/600,()=>0);socialStep(saved,1/600,()=>0);}
assert.deepEqual(w,saved);assert(!f.socialAction,'Releases encounter after its duration');assert(f.pregnant);
for(const fps of [30,60,120]){let previous=encounterPose(0);for(let i=1;i<=ENCOUNTER_SECONDS*fps;i++){const pose=encounterPose(i/fps);assert(Object.values(pose).every(v=>typeof v!=='number'||Number.isFinite(v)));assert(Math.abs(pose.x-previous.x)<.035);if(pose.close>.1)assert(pose.lift>.7,'Raise before approaching the body');previous=pose;}}
const demo=createWorld(9),rng=demo.rngState;prepareDemoActivity(demo);assert.equal(demo.rngState,rng);applyHabitatActivity(demo);assert(playActivity.size>=1,'Toy activity from the first tick');assert(Object.values(demo.rats).filter(r=>Math.hypot(r.vx,r.vy)>.1).length>=2,'Multiple explorers immediately');
for(const r of Object.values(demo.rats))assert(clearPath(r,r));
console.log('PASS: coordinated encounter, delayed single conception, expiry, snapshot determinism, continuous timeline at 30/60/120 FPS, active demo opening');

// A second pair cannot reserve an already occupied encounter patch.
{const world=createWorld(91),r=Object.values(world.rats),female=r.filter(r=>r.sex==='F'),male=r.filter(r=>r.sex==='M');world.social={affinities:{},cooldown:99,nextAmbient:99};
 const held={started:0,heading:0,x:NEST_POS.x,y:NEST_POS.y,scale:1};
 for(const [i,rat] of [female[0],male[0]].entries())rat.socialAction={kind:'mating',partner:i?female[0].id:male[0].id,until:1,encounter:{...held}};
 female[1].x=NEST_POS.x;female[1].y=NEST_POS.y;
 male[1].x=NEST_POS.x-42;male[1].y=NEST_POS.y+6;
 for(const rat of [female[1],male[1]]){rat.energy=1;rat.pregnant=null;rat.nursing=[];rat.socialAction={kind:'courtship',partner:rat===female[1]?male[1].id:female[1].id,until:1,alignment:0};}
 for(let i=0;i<60;i++)socialStep(world,1/600,()=>1);
 assert(!female[1].socialAction?.encounter,'No overlapping reserved pairs');
 const x=female[0].x,y=female[0].y;female[1].x=x;female[1].y=y;
 for(let i=0;i<40;i++)separateRats(world);
 assert.equal(female[0].x,x);assert.equal(female[0].y,y);assert(Math.hypot(female[1].x-x,female[1].y-y)>12,'Bystander moves away while pair stays anchored');
 male[0].deadAt=0;socialStep(world,1/600,()=>1);assert(!female[0].socialAction,'Death releases the reservation');}
console.log('PASS: overlapping reservations rejected, bystander separation, partner death cleanup');

{const opening=createWorld(17);prepareDemoActivity(opening);const start=Object.fromEntries(Object.values(opening.rats).map(r=>[r.id,{x:r.x,y:r.y}]));const distance:Record<string,number>={};let activeTicks=0;
 for(let i=0;i<600;i++){opening.simDay+=1/600;applyHabitatActivity(opening);if(Object.values(opening.rats).some(r=>Math.hypot(r.vx,r.vy)>.1))activeTicks++;for(const r of Object.values(opening.rats)){assert(clearPath(r,r));distance[r.id]=Math.max(distance[r.id]??0,Math.hypot(r.x-start[r.id].x,r.y-start[r.id].y));}}
 assert(activeTicks>540,'Opening stays active through the first minute');assert(Object.values(distance).filter(d=>d>100).length>=3,'Explorers leave their starting areas');}
console.log('PASS: first minute remains active with valid navigation');
