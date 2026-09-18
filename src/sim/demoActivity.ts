import type {World} from '../types.js';
import {habitatRoutes,toyApproaches,wheelToys} from './habitatLayout.js';
import {safeGuide} from './navigation.js';
import {inNest} from './colony.js';
/** Demo staging only: never rewrites live genesis, snapshots or on-chain history. */
export function prepareDemoActivity(world:World){
 const rats=Object.values(world.rats),wheel=toyApproaches.find(a=>wheelToys.has(a.toy));
 for(let i=1;i<rats.length;i++){
  const r=rats[i],route=i%habitatRoutes.length,waypoint=25+i*12;
  const point=safeGuide({x:habitatRoutes[route][waypoint].x,y:habitatRoutes[route][waypoint].z});
  r.x=point.x;r.y=point.y;r.inNest=inNest(r);
  r.exploration={route,waypoint,restUntil:0};
 }
 if(wheel&&rats[1]){const r=rats[1];r.x=wheel.contact.x;r.y=wheel.contact.z;r.inNest=inNest(r);r.exploration={route:wheel.toy,waypoint:wheel.waypoint+1,restUntil:0,playingUntil:world.simDay+.12};}
}
