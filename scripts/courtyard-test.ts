import assert from 'node:assert/strict';
import {courtyardLoop,socialDens,denSeat,denWalls} from '../src/sim/courtyard';
import {walkable,findPath,clearPath} from '../src/sim/navigation';
import {createWorld,NEST_POS} from '../src/sim/colony';
import {chooseDen} from '../src/sim/socialDens';
import {pairKey} from '../src/sim/social';
import {crowding} from '../src/sim/crowding';
import {zoneOf} from '../src/sim/ecology';
import {applyHabitatActivity} from '../src/sim/habitatActivity';
import {separateRats} from '../src/sim/separation';
import {CONFIG} from '../src/config';
for(const p of [...courtyardLoop,...socialDens.flatMap((d,i)=>Array.from({length:d.capacity},(_,slot)=>denSeat(i,slot)))]){assert(walkable(p),'destination '+JSON.stringify(p));const path=findPath(NEST_POS,p);assert(path,'connected destination '+JSON.stringify(p));let from=NEST_POS;for(const q of path){assert(clearPath(from,q));from={...from,...q}}}
for(const w of denWalls){assert(!walkable(w));assert(!clearPath({x:w.x-25,y:w.y},{x:w.x+25,y:w.y}),'walls cannot be crossed');}
const w=createWorld(),[a,b,c]=Object.values(w.rats);w.social={affinities:{[pairKey(a,b)]:.95,[pairKey(a,c)]:-.9},cooldown:0,nextAmbient:0};b.exploration={route:0,waypoint:0,restUntil:0,den:0,denSlot:0,denUntil:2};c.exploration={route:0,waypoint:0,restUntil:0,den:1,denSlot:0,denUntil:2};a.x=800;a.y=800;assert.equal(chooseDen(w,a)?.index,0,'prefers friendly company and avoids rival');
for(let i=1;i<6;i++){const q=structuredClone(b);q.id='occupant'+i;q.exploration!.denSlot=i;w.rats[q.id]=q;}assert.notEqual(chooseDen(w,a)?.index,0,'reservation capacity respected');
assert.equal(CONFIG.colony.maxAlive,110);assert.equal(crowding(70,.12).pressure,0);assert(crowding(90,.12).pressure>.6);assert.equal(crowding(100,.12).pressure,1);
console.log('PASS: all courtyard/den destinations connected, swept walls, affinity preference, reservation capacity, congestion curve 70/90/100');

assert.equal(zoneOf({x:800,y:730}),6); for(let i=0;i<3;i++)assert.equal(zoneOf(denSeat(i,0)),7+i);

for(const population of [40,90,110]){
 const world=createWorld(),template=Object.values(world.rats)[0];world.env.panic=0;
 for(let i=4;i<population;i++){const r=structuredClone(template);r.id='den-test-'+i;world.rats[r.id]=r;}
 for(const r of Object.values(world.rats)){r.energy=.9;r.pregnant=null;r.nursing=[];r.socialAction=undefined;r.exploration=undefined;r.x=NEST_POS.x;r.y=NEST_POS.y;if(r.wellbeing)r.wellbeing.hydration=1;}
 const arrived=new Set<string>();
 for(let tick=0;tick<1200;tick++){
  world.simDay+=.0025;applyHabitatActivity(world);separateRats(world);
  const occupied=new Set<string>();
  for(const r of Object.values(world.rats)){
   assert(walkable(r),'invalid position '+r.id);assert(Number.isFinite(r.x+r.y));
   const e=r.exploration;if(e?.den===undefined)continue;
   const key=e.den+':'+e.denSlot;assert(!occupied.has(key),'duplicate reservation');occupied.add(key);
   if(Math.hypot(r.x-denSeat(e.den,e.denSlot!).x,r.y-denSeat(e.den,e.denSlot!).y)<22)arrived.add(r.id);
  }
  assert(occupied.size<=18);
 }
 assert(arrived.size>=6,'too few arrivals: '+population+' / '+arrived.size);
 console.log('PASS: population',population,'distinct den visitors',arrived.size,'no invalid terrain or duplicate reservations');
}
