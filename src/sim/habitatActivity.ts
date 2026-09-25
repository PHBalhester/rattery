import {familyNest} from './familyNest.js';
import {courtyardLoop,denSeat} from './courtyard.js';
import {chooseDen} from './socialDens.js';
import {movementSpeed} from './movementSpeed.js';
import {zones,zoneOf} from './ecology.js';
import type {World} from '../types.js';
import {NEST_POS,inNest} from './colony.js';
import {habitatRoutes,toyApproaches,wheelToys,diggingToy} from './habitatLayout.js';
import {findPath,advance,clearPath,safeGuide,recoverPosition} from './navigation.js';
import {playActivity} from './playActivity.js';
function hashId(id:string){let n=0;for(const c of id)n=(n*31+c.charCodeAt(0))>>>0;return n;}
const trips=habitatRoutes.map((route,index)=>route.flatMap((p,i)=>{
 const points=[{...safeGuide({x:p.x,y:p.z}),toy:false}];const toy=toyApproaches.find(a=>a.toy===index&&a.waypoint===i);
 if(toy)points.push({x:toy.contact.x,y:toy.contact.z,toy:true},{x:p.x,y:p.z,toy:false});return points;
}));
trips.push(courtyardLoop.map(p=>({...p,toy:false})));
/** Serialized waypoint progress pauses during encounters and resumes from the current position. */
export function applyHabitatActivity(world:World){
 playActivity.clear();
 const population=Object.values(world.rats).filter(q=>q.deadAt===null).length;
 // Reserve a whole planned litter before birth; existing nursing families stay together.
 const familyLoad=zones.slice(0,6).map(()=>0);
 for(const q of Object.values(world.rats))if(q.deadAt===null){familyLoad[zoneOf(q)<6?zoneOf(q):0]++;if(q.pregnant)familyLoad[q.maternalNest?.zone??0]+=q.pregnant.plannedLitter;}
 for(const dam of Object.values(world.rats))if(dam.deadAt===null&&dam.pregnant&&!dam.nursing.length&&!dam.maternalNest&&dam.pregnant.dueAt-world.simDay>1&&world.habitatMode!=='basic'){
  const size=1+dam.pregnant.plannedLitter;
  const options=zones.slice(1,6).map((z,j)=>({z,i:j+1})).filter(v=>familyLoad[v.i]+size<=v.z.capacity&&findPath(dam,v.z)).sort((a,b)=>familyLoad[a.i]-familyLoad[b.i]||Math.hypot(dam.x-a.z.x,dam.y-a.z.y)-Math.hypot(dam.x-b.z.x,dam.y-b.z.y)||a.i-b.i);
  if(options.length){const {z,i}=options[0];dam.maternalNest={x:z.x,y:z.y,r:35,zone:i};familyLoad[0]=Math.max(0,familyLoad[0]-size);familyLoad[i]+=size;if(dam.exploration){delete dam.exploration.path;delete dam.exploration.waterZone;}}
 }
 const occupied=new Set<number>();
 // Keep thirsty residents spread across every reachable water point. Existing
 // commitments are counted once; new commitments reserve a slot immediately.
 const waterCommitments=zones.slice(0,6).map(()=>0);
 for(const q of Object.values(world.rats))if(q.deadAt===null&&q.exploration?.waterZone!==undefined&&q.exploration.waterZone<6)waterCommitments[q.exploration.waterZone]++;
 const departures=trips.map(()=>0);for(const r of Object.values(world.rats))if(r.deadAt===null&&r.exploration&&r.exploration.waypoint>0)departures[r.exploration.route]++;
 const counts=zones.map(()=>0);for(const r of Object.values(world.rats))if(r.deadAt===null)counts[zoneOf(r)]++;
 // Count committed departures once, so successive ticks do not send the whole nest away.
 for(const r of Object.values(world.rats))if(r.deadAt===null&&r.exploration?.den!==undefined&&(r.exploration.denUntil??0)>world.simDay&&zoneOf(r)<7)counts[zoneOf(r)]--;
 for(const r of Object.values(world.rats)){
  if(r.deadAt!==null||r.stage==='neonate'||r.stage==='juvenile')continue;
  const recovery=recoverPosition(r,movementSpeed(r,world));
  if(recovery){r.vx=recovery.x-r.x;r.vy=recovery.y-r.y;r.x=recovery.x;r.y=recovery.y;r.inNest=inNest(r);if(r.exploration){delete r.exploration.path;delete r.exploration.target;}continue;}
  if(r.exploration?.den!==undefined&&(r.socialAction||r.retrieving||world.simDay>=(r.exploration.denUntil??0))){delete r.exploration.den;delete r.exploration.denSlot;delete r.exploration.path;r.exploration.denCooldown=world.simDay+.5;}
  if(r.socialAction){if(r.exploration){r.exploration.playingUntil=world.simDay;delete r.exploration.path;delete r.exploration.target;}continue;}
  if(r.retrieving){if(r.exploration)r.exploration.playingUntil=world.simDay;continue;}
  const state=r.exploration??(r.exploration={route:hashId(r.id)%trips.length,waypoint:0,restUntil:0});
  const shelter=!!r.pregnant||r.nursing.length>0||world.env.panic>.45||r.energy<.28;
  const hydration=r.wellbeing?.hydration??1;
  if(hydration>=.85)delete state.waterZone;
  if(state.waterZone===undefined&&hydration<.6){
   // Commit to the shortest reachable water route, not a shifting crowd score.
   const candidates=zones.slice(0,world.habitatMode==='basic'||r.nursing.length>0||r.pregnant?1:6).map((z,i)=>{
    const path=findPath(r,z);let distance=0,previous={x:r.x,y:r.y};
    for(const point of path??[]){distance+=Math.hypot(point.x-previous.x,point.y-previous.y);previous=point;}
    return {i,distance:path?distance:Infinity,load:waterCommitments[i]/Math.max(1,z.capacity)};
   }).filter(v=>Number.isFinite(v.distance)).sort((a,b)=>a.load-b.load||a.distance-b.distance||a.i-b.i);
   if(r.maternalNest&&(r.nursing.length||r.pregnant))state.waterZone=r.maternalNest.zone;else if(candidates.length)state.waterZone=candidates[0].i;
   if(state.waterZone!==undefined&&state.waterZone<6)waterCommitments[state.waterZone]++;
  }
  const thirsty=state.waterZone!==undefined||hydration<.6;
  const seekingQuiet=(r.wellbeing?.chronic??0)>.5&&!shelter;

  const enriched=world.habitatMode!=='basic';
  if(state.den!==undefined&&(shelter||thirsty||!enriched)){delete state.den;delete state.denSlot;delete state.path;state.denCooldown=world.simDay+.5;}
  // Temporary care keeps healthy adults active in the enriched habitat. The
  // usual high-population retreat would otherwise send nearly everyone into
  // dens and make the requested supervised toy activity impossible.
  if(enriched&&!world.careProtection?.active&&!shelter&&!thirsty&&state.den===undefined&&world.simDay>=(state.denCooldown??0)&&(counts[zoneOf(r)]/zones[zoneOf(r)].capacity>=.7||population>=40||r.energy<.55||(r.wellbeing?.isolationDistress??0)>.2)){
   const den=chooseDen(world,r);state.denCooldown=world.simDay+.25;
   if(den){counts[zoneOf(r)]=Math.max(0,counts[zoneOf(r)]-1);state.den=den.index;state.denSlot=den.slot!;state.denUntil=world.simDay+1.5;delete state.path;state.playingUntil=world.simDay;}
  }
  const restingInDen=state.den!==undefined;

  const playPoint=toyApproaches.find(a=>a.toy===state.route)?.contact;
  if(!enriched||shelter||thirsty||seekingQuiet||!playPoint||Math.hypot(r.x-playPoint.x,r.y-playPoint.z)>2)state.playingUntil=world.simDay;
  const refuge=state.waterZone!==undefined?{z:zones[state.waterZone],i:state.waterZone}:zones.map((z,i)=>({z,i,score:counts[i]/z.capacity+Math.hypot(z.x-r.x,z.y-r.y)/3000})).filter(v=>(v.i<6||(!thirsty&&v.i===6))&&(enriched||!thirsty||v.i===0)).sort((a,b)=>a.score-b.score)[0];
  // A rat already in the nest need not reach its exact center before leaving.
  if(state.waypoint===0&&inNest(r)&&!shelter){
   const preferred=state.route;
   state.route=trips.map((_,i)=>i).sort((a,b)=>departures[a]-departures[b]||((a-preferred+trips.length)%trips.length)-((b-preferred+trips.length)%trips.length))[0];
   departures[state.route]++;state.waypoint=1;
  }
  // Nearby route checkpoints are guidance, not single-occupant destinations.
  // Separation can push a rat past one; advance without forcing it to turn back.
  if(!restingInDen&&!shelter&&!thirsty&&!seekingQuiet)while(state.waypoint<trips[state.route].length-1){
   const checkpoint=trips[state.route][state.waypoint],next=trips[state.route][state.waypoint+1];
   if(checkpoint.toy||Math.hypot(r.x-checkpoint.x,r.y-checkpoint.y)>28||!clearPath(r,next))break;
   state.waypoint++;
  }
  const angle=hashId(r.id)*2.399963,radius=25+hashId(r.id)%25;
  const home=familyNest(r),homeRadius=Math.min(radius,home.r*.5);
  const nestPlace={x:home.x+Math.cos(angle)*homeRadius,y:home.y+Math.sin(angle)*homeRadius,toy:false};
  const target=restingInDen?{...denSeat(state.den!,state.denSlot!),toy:false}:thirsty||seekingQuiet?{...refuge.z,toy:false}:shelter?nestPlace:trips[state.route][state.waypoint];
  const key=restingInDen?`den:${state.den}:${state.denSlot}`:thirsty||seekingQuiet?`resource:${refuge.i}`:shelter?'nest':`${state.route}:${state.waypoint}`;
  r.vx=r.vy=0;
  if(!restingInDen&&!shelter&&!thirsty&&!seekingQuiet&&world.simDay<(state.playingUntil??0)){if(wheelToys.has(state.route)){if(occupied.has(state.route)){state.playingUntil=world.simDay;continue;}occupied.add(state.route);}playActivity.set(r.id,{toy:state.route,kind:state.route===diggingToy?'digging':wheelToys.has(state.route)?'wheel':state.route%2===0?'ball':'chewing',since:state.playingUntil!-.12,until:state.playingUntil!});continue;}
  if(!restingInDen&&!shelter&&!thirsty&&!seekingQuiet&&world.simDay<state.restUntil)continue;
  if(state.target!==key||!state.path||(thirsty&&state.path.length===0&&Math.hypot(r.x-target.x,r.y-target.y)>45)){state.path=findPath(r,target)??undefined;state.target=key;}
  if(!state.path)continue; // Legacy positions outside navigable terrain stay put, never snap.
  // The graph's shared nest node is a routing aid, not a required footfall.
  if(state.path.length>1&&Math.hypot(state.path[0].x-NEST_POS.x,state.path[0].y-NEST_POS.y)<1){
   const first=state.path[0],second=state.path[1],exit={x:first.x+(second.x-first.x)*.45,y:first.y+(second.y-first.y)*.45};
   if(clearPath(r,exit)&&clearPath(exit,second))state.path[0]=exit;
  }
  // Shared waypoints are guides: separation must not prevent two rats from passing them.
  while(state.path.length>1&&Math.hypot(r.x-state.path[0].x,r.y-state.path[0].y)<(thirsty?35:28)&&clearPath(r,state.path[1]))state.path.shift();
  // Ordinary route endpoints are shared guidance, not exact contact targets.
  // Separation can keep two residents orbiting a terminal waypoint forever.
  // Keep exact arrival for toys, shelter, water and reserved den positions.
  if(!restingInDen&&!shelter&&!thirsty&&!seekingQuiet&&!target.toy&&state.path.length===1&&Math.hypot(r.x-target.x,r.y-target.y)<=12&&clearPath(r,target))state.path=[];
  const next=advance(r,state.path,movementSpeed(r,world));
  if(!clearPath(r,next)){delete state.path;continue;}
  r.vx=next.x-r.x;r.vy=next.y-r.y;r.x=next.x;r.y=next.y;r.inNest=inNest(r);
  if(state.path.length)continue;
  if(restingInDen||thirsty||seekingQuiet){continue;}
  if(shelter){state.waypoint=0;state.restUntil=world.simDay+.1;returnToIdle();continue;}
  if(enriched&&target.toy&&(!wheelToys.has(state.route)||(!occupied.has(state.route)&&r.energy>.55))){if(wheelToys.has(state.route))occupied.add(state.route);state.playingUntil=world.simDay+.12;playActivity.set(r.id,{toy:state.route,kind:state.route===diggingToy?'digging':wheelToys.has(state.route)?'wheel':state.route%2===0?'ball':'chewing',since:world.simDay,until:world.simDay+.12});}
  state.waypoint++;
  if(state.waypoint>=trips[state.route].length){state.waypoint=0;state.route=(state.route+1)%trips.length;state.restUntil=world.simDay+.3;}
  returnToIdle();
  function returnToIdle(){delete state.path;delete state.target;}
 }
}
