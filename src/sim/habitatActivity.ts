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
/** Serialized waypoint progress pauses during encounters and resumes from the current position. */
export function applyHabitatActivity(world:World){
 playActivity.clear();
 const occupied=new Set<number>();
 const departures=trips.map(()=>0);for(const r of Object.values(world.rats))if(r.deadAt===null&&r.exploration&&r.exploration.waypoint>0)departures[r.exploration.route]++;
 const counts=zones.map(()=>0);for(const r of Object.values(world.rats))if(r.deadAt===null)counts[zoneOf(r)]++;
 for(const r of Object.values(world.rats)){
  if(r.deadAt!==null||r.stage==='neonate'||r.stage==='juvenile')continue;
  const recovery=recoverPosition(r,movementSpeed(r,world));
  if(recovery){r.vx=recovery.x-r.x;r.vy=recovery.y-r.y;r.x=recovery.x;r.y=recovery.y;r.inNest=inNest(r);if(r.exploration){delete r.exploration.path;delete r.exploration.target;}continue;}
  if(r.socialAction){if(r.exploration){r.exploration.playingUntil=world.simDay;delete r.exploration.path;delete r.exploration.target;}continue;}
  if(r.retrieving){if(r.exploration)r.exploration.playingUntil=world.simDay;continue;}
  const state=r.exploration??(r.exploration={route:hashId(r.id)%trips.length,waypoint:0,restUntil:0});
  const shelter=!!r.pregnant||r.nursing.length>0||world.env.panic>.45||r.energy<.28;
  const thirsty=(r.wellbeing?.hydration??1)<.4;
  const seekingQuiet=(r.wellbeing?.chronic??0)>.5&&!shelter;

  const enriched=world.habitatMode!=='basic';
  const playPoint=toyApproaches.find(a=>a.toy===state.route)?.contact;
  if(!enriched||shelter||thirsty||seekingQuiet||!playPoint||Math.hypot(r.x-playPoint.x,r.y-playPoint.z)>2)state.playingUntil=world.simDay;
  const refuge=zones.map((z,i)=>({z,i,score:counts[i]/z.capacity+Math.hypot(z.x-r.x,z.y-r.y)/3000})).filter(v=>enriched||!thirsty||v.i===0).sort((a,b)=>a.score-b.score)[0];
  // A rat already in the nest need not reach its exact center before leaving.
  if(state.waypoint===0&&inNest(r)&&!shelter){
   const preferred=state.route;
   state.route=trips.map((_,i)=>i).sort((a,b)=>departures[a]-departures[b]||((a-preferred+trips.length)%trips.length)-((b-preferred+trips.length)%trips.length))[0];
   departures[state.route]++;state.waypoint=1;
  }
  // Nearby route checkpoints are guidance, not single-occupant destinations.
  // Separation can push a rat past one; advance without forcing it to turn back.
  if(!shelter&&!thirsty&&!seekingQuiet)while(state.waypoint<trips[state.route].length-1){
   const checkpoint=trips[state.route][state.waypoint],next=trips[state.route][state.waypoint+1];
   if(checkpoint.toy||Math.hypot(r.x-checkpoint.x,r.y-checkpoint.y)>28||!clearPath(r,next))break;
   state.waypoint++;
  }
  const angle=hashId(r.id)*2.399963,radius=25+hashId(r.id)%25;
  const nestPlace={x:NEST_POS.x+Math.cos(angle)*radius,y:NEST_POS.y+Math.sin(angle)*radius,toy:false};
  const target=thirsty||seekingQuiet?{...refuge.z,toy:false}:shelter?nestPlace:trips[state.route][state.waypoint];
  const key=thirsty||seekingQuiet?`resource:${refuge.i}`:shelter?'nest':`${state.route}:${state.waypoint}`;
  r.vx=r.vy=0;
  if(!shelter&&!thirsty&&!seekingQuiet&&world.simDay<(state.playingUntil??0)){if(wheelToys.has(state.route)){if(occupied.has(state.route)){state.playingUntil=world.simDay;continue;}occupied.add(state.route);}playActivity.set(r.id,{toy:state.route,kind:state.route===diggingToy?'digging':wheelToys.has(state.route)?'wheel':state.route%2===0?'ball':'chewing',since:state.playingUntil!-.12,until:state.playingUntil!});continue;}
  if(!shelter&&!thirsty&&!seekingQuiet&&world.simDay<state.restUntil)continue;
  if(state.target!==key||!state.path){state.path=findPath(r,target)??undefined;state.target=key;}
  if(!state.path)continue; // Legacy positions outside navigable terrain stay put, never snap.
  // The graph's shared nest node is a routing aid, not a required footfall.
  if(state.path.length>1&&Math.hypot(state.path[0].x-NEST_POS.x,state.path[0].y-NEST_POS.y)<1){
   const first=state.path[0],second=state.path[1],exit={x:first.x+(second.x-first.x)*.45,y:first.y+(second.y-first.y)*.45};
   if(clearPath(r,exit)&&clearPath(exit,second))state.path[0]=exit;
  }
  const next=advance(r,state.path,movementSpeed(r,world));
  if(!clearPath(r,next)){delete state.path;continue;}
  r.vx=next.x-r.x;r.vy=next.y-r.y;r.x=next.x;r.y=next.y;r.inNest=inNest(r);
  if(state.path.length)continue;
  if(thirsty||seekingQuiet){continue;}
  if(shelter){state.waypoint=0;state.restUntil=world.simDay+.1;returnToIdle();continue;}
  if(enriched&&target.toy&&(!wheelToys.has(state.route)||(!occupied.has(state.route)&&r.energy>.55))){if(wheelToys.has(state.route))occupied.add(state.route);state.playingUntil=world.simDay+.12;playActivity.set(r.id,{toy:state.route,kind:state.route===diggingToy?'digging':wheelToys.has(state.route)?'wheel':state.route%2===0?'ball':'chewing',since:world.simDay,until:world.simDay+.12});}
  state.waypoint++;
  if(state.waypoint>=trips[state.route].length){state.waypoint=0;state.route=(state.route+1)%trips.length;state.restUntil=world.simDay+.3;}
  returnToIdle();
  function returnToIdle(){delete state.path;delete state.target;}
 }
}
