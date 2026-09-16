import {CatmullRomCurve3,Vector3,MathUtils} from 'three';
import {NEST_POS as N} from './colony';
import {CONFIG} from '../config';
const W=CONFIG.colony.burrowWidth,H=CONFIG.colony.burrowHeight;
export const habitatRoutes=[[.12,.18],[.84,.16],[.12,.78],[.89,.79],[.48,.12]].map(([x,y])=>{
  const end=new Vector3(x*1600,0,y*900),nest=new Vector3(N.x,0,N.y);
  const entrance=end.clone().sub(nest).normalize().multiplyScalar(N.r+19.5).add(nest);
  const mid=nest.clone().add(end).multiplyScalar(.5);mid.x+=60;
  const tunnel=new CatmullRomCurve3([entrance,mid,end]).getSpacedPoints(80);
  // Follow the open tunnel to its chamber, then explore the terrain beyond its mouth.
  const outward=end.clone().sub(mid).normalize(),side=new Vector3(-outward.z,0,outward.x);
  const outdoor=[end.clone().addScaledVector(outward,65),end.clone().addScaledVector(outward,100).addScaledVector(side,65),end.clone().addScaledVector(outward,150),end.clone().addScaledVector(outward,100).addScaledVector(side,-65),end.clone().addScaledVector(outward,65),end];
  for(const p of outdoor){p.x=Math.max(65,Math.min(W-65,p.x));p.z=Math.max(65,Math.min(H-65,p.z));}
  return [nest,...tunnel,...outdoor,...tunnel.slice().reverse(),nest];
});

// Preserve existing coordinates and saved rat positions; expansion adds outer loops.
export const lateralRoutes=[[0,4],[4,1],[1,3],[3,2]].map(([a,b])=>{
 const start=habitatRoutes[a][85],end=habitatRoutes[b][85];
 const mid=start.clone().lerp(end,.5);
 if(a===1)mid.x=1800;
 if(a===3)mid.z=980;
 return new CatmullRomCurve3([start,mid,end]).getSpacedPoints(80);
});
export const wheelToys=new Set([1,3]);
export const tunnelRoutes=habitatRoutes.map(r=>r.slice(1,82));

function segmentDistance(p:Vector3,a:Vector3,b:Vector3){const d=b.clone().sub(a);return p.distanceTo(a.clone().addScaledVector(d,MathUtils.clamp(p.clone().sub(a).dot(d)/(d.lengthSq()||1),0,1)));}
// All solid toys sit outside the full route corridor, including the rat's body and tail.
export const obstacles=habitatRoutes.flatMap((route,index)=>{
 const end=route[81],forward=end.clone().sub(route[80]).normalize(),side=new Vector3(-forward.z,0,forward.x);
 for(const sign of [1,-1])for(const offset of [95,120,145]){const p=end.clone().addScaledVector(side,offset*sign);if(p.x<65||p.x>W-65||p.z<65||p.z>H-65)continue;
 let clearance=Infinity;for(const path of [...habitatRoutes,...lateralRoutes])for(let i=1;i<path.length;i++)clearance=Math.min(clearance,segmentDistance(p,path[i-1],path[i]));
 if(clearance>65)return [{p,index,clearance}];
 }return [];
});
// A reversible side trip from an outdoor waypoint. Never shortcut through the burrow.
export const toyApproaches=obstacles.map(toy=>{
 const route=habitatRoutes[toy.index];let waypoint=82,best=Infinity;
 for(let i=82;i<=86;i++){const d=route[i].distanceTo(toy.p);if(d<best){best=d;waypoint=i;}}
 const anchor=route[waypoint],contact=toy.p.clone().addScaledVector(anchor.clone().sub(toy.p).normalize(),toy.index%2===0?40:45);
 return {toy:toy.index,waypoint,anchor,contact};
});


// Low platforms follow the existing outdoor loop: ramp, deck, ramp.
export const platformPaths=[0,2].map(index=>({index,points:habitatRoutes[index].slice(82,85)}));
export function platformHeight(x:number,y:number){
 for(const platform of platformPaths){const [a,b,c]=platform.points;
  for(const [start,end,rising] of [[a,b,true],[b,c,false]] as const){
   const dx=end.x-start.x,dy=end.z-start.z,length=dx*dx+dy*dy;
   const t=((x-start.x)*dx+(y-start.z)*dy)/length;
   if(t<0||t>1||Math.hypot(x-start.x-dx*t,y-start.z-dy*t)>14)continue;
   const progress=rising?t:1-t;
   return Math.max(0,Math.min(1,progress/.65))*18;
  }
 }
 return 0;
}
export const diggingToy=4;

// Blender refuge side sills/posts: x ±.94, width .13, depth1.24, converted at30 units/metre.
export const refugeWalls=habitatRoutes.flatMap(route=>[-1,1].map(sign=>({x:route[81].x+sign*.94*30,y:route[81].z,halfX:.065*30,halfY:.62*30})));
export const refugeClearance=20; // adult body envelope; the thin flexible tail is excluded.
export function refugeBlocked(p:{x:number;y:number}){return refugeWalls.some(w=>Math.hypot(Math.max(0,Math.abs(p.x-w.x)-w.halfX),Math.max(0,Math.abs(p.y-w.y)-w.halfY))<refugeClearance);}

/** Exact swept circle against the refuge rectangles, including rounded corners. */
export function refugePathBlocked(a:{x:number;y:number},b:{x:number;y:number}){
 const dx=b.x-a.x,dy=b.y-a.y,len=dx*dx+dy*dy;
 return refugeWalls.some(w=>{
  const minX=w.x-w.halfX,maxX=w.x+w.halfX,minY=w.y-w.halfY,maxY=w.y+w.halfY;
  let lo=0,hi=1;
  for(const [v,d,min,max] of [[a.x,dx,minX,maxX],[a.y,dy,minY,maxY]]){
   if(Math.abs(d)<1e-10){if(v<min||v>max){lo=2;break;}}
   else{const t0=(min-v)/d,t1=(max-v)/d;lo=Math.max(lo,Math.min(t0,t1));hi=Math.min(hi,Math.max(t0,t1));}
  }
  if(lo<=hi)return true;
  const endpoint=(p:{x:number;y:number})=>Math.hypot(Math.max(0,minX-p.x,p.x-maxX),Math.max(0,minY-p.y,p.y-maxY));
  let distance=Math.min(endpoint(a),endpoint(b));
  for(const x of [minX,maxX])for(const y of [minY,maxY]){const t=Math.max(0,Math.min(1,((x-a.x)*dx+(y-a.y)*dy)/(len||1)));distance=Math.min(distance,Math.hypot(x-a.x-dx*t,y-a.y-dy*t));}
  return distance<refugeClearance;
 });
}
