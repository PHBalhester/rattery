import * as T from 'three';
import {habitatRoutes,tunnelRoutes,obstacles,refugeWalls} from '../sim/habitatLayout';
import {CONFIG} from '../config';
import type {Ground} from './StudyFootMotor';
type Barrier={ax:number;az:number;bx:number;bz:number;radius:number;bottom:number;top:number};
const barriers:Barrier[]=[];
const world=(x:number,z:number)=>({x:(x-CONFIG.colony.burrowWidth/2)/30,z:(z-CONFIG.colony.burrowHeight/2)/30});
for(const route of tunnelRoutes)for(const sign of [-1,1]){
 const points=route.map((p,i)=>{const a=route[Math.max(0,i-1)],b=route[Math.min(route.length-1,i+1)],dx=b.x-a.x,dz=b.z-a.z,d=Math.hypot(dx,dz)||1,c=world(p.x,p.z);return {x:c.x-dz/d*1.215*sign,z:c.z+dx/d*1.215*sign};});
 for(let i=1;i<points.length;i++)barriers.push({ax:points[i-1].x,az:points[i-1].z,bx:points[i].x,bz:points[i].z,radius:.16,bottom:-.12,top:.43});
}
for(const wall of refugeWalls){const c=world(wall.x,wall.y);barriers.push({ax:c.x,az:c.z-.55,bx:c.x,bz:c.z+.55,radius:.095,bottom:-.12,top:1.15});}
for(const route of habitatRoutes){const c=world(route[81].x,route[81].z);barriers.push({ax:c.x+.5,az:c.z-.48,bx:c.x+.5,bz:c.z-.48,radius:.35,bottom:-.1,top:.2});}
for(const o of obstacles){const c=world(o.p.x,o.p.z);barriers.push({ax:c.x,az:c.z,bx:c.x,bz:c.z,radius:.72,bottom:-.15,top:1.5});}
const grid=new Map<string,Barrier[]>();
for(const b of barriers)for(let x=Math.floor(Math.min(b.ax,b.bx)-b.radius-.1);x<=Math.floor(Math.max(b.ax,b.bx)+b.radius+.1);x++)for(let z=Math.floor(Math.min(b.az,b.bz)-b.radius-.1);z<=Math.floor(Math.max(b.az,b.bz)+b.radius+.1);z++){const key=x+':'+z;const bucket=grid.get(key)??[];bucket.push(b);grid.set(key,bucket);}
/** Conservative render-only colliders matching the low edges, refuge sides, bowls and toys. */
export function projectTailPoint(p:T.Vector3,radius:number,ground:Ground){
 const q=p.clone();q.y=Math.max(q.y,ground(q.x,q.z)+radius);
 for(const b of grid.get(Math.floor(q.x)+':'+Math.floor(q.z))??[]){
  if(q.y-radius>b.top||q.y+radius<b.bottom)continue;
  const dx=b.bx-b.ax,dz=b.bz-b.az,t=T.MathUtils.clamp(((q.x-b.ax)*dx+(q.z-b.az)*dz)/(dx*dx+dz*dz||1),0,1),x=b.ax+t*dx,z=b.az+t*dz;
  const vx=q.x-x,vz=q.z-z,d=Math.hypot(vx,vz),overlap=b.radius+radius-d;if(overlap<=0)continue;
  if(b.top+radius-q.y<overlap){q.y=b.top+radius;continue;}
  if(d>1e-8){q.x+=vx/d*overlap;q.z+=vz/d*overlap;}else q.x+=b.radius+radius;
 }
 return q;
}
/** Keep the attachment fixed and curl the chain when its animated envelope meets scenery. */
export class TailCollision {
 private joints:{bone:T.Bone;end:T.Vector3;radius:number;axis:T.Vector3}[]=[];private curl=0;
 constructor(bones:Map<string,T.Bone>){
  for(let i=0;i<6;i++){const bone=bones.get('caudal'+i)!;bone.updateWorldMatrix(true,true);let end:T.Vector3;
   if(i<5)end=bones.get('caudal'+(i+1))!.getWorldPosition(new T.Vector3());
   else {const p=bone.getWorldPosition(new T.Vector3()),prev=bones.get('caudal4')!.getWorldPosition(new T.Vector3());end=p.clone().add(p.clone().sub(prev));}
   this.joints.push({bone,end:bone.worldToLocal(end),radius:.047*(1-i/6)+.01,axis:new T.Vector3(0,0,1).applyQuaternion(bone.getWorldQuaternion(new T.Quaternion()).invert()).normalize()});
  }
 }
 update(dt:number,ground:Ground,enabled:boolean,reset:boolean){
  if(reset||!enabled)this.curl=0;if(!enabled)return;
  const poses=this.joints.map(j=>j.bone.quaternion.clone());
  const apply=(curl:number)=>{this.joints.forEach((j,i)=>j.bone.quaternion.copy(poses[i]).multiply(new T.Quaternion().setFromAxisAngle(j.axis,-curl*(i===0?1:i===3?.55:0))));this.joints[0].bone.updateWorldMatrix(true,true);};
  const score=()=>{let value=0;for(const j of this.joints){const origin=new T.Vector3().setFromMatrixPosition(j.bone.matrixWorld),end=j.end.clone().applyMatrix4(j.bone.matrixWorld),scale=new T.Vector3().setFromMatrixScale(j.bone.matrixWorld).y;for(const t of [0,.25,.5,.75,1]){const p=origin.clone().lerp(end,t);value+=projectTailPoint(p,j.radius*scale,ground).distanceToSquared(p);}}return value;};
  // Release gradually; when threatened, find the shallowest clear curl.
  let best=this.curl*Math.exp(-5*Math.min(.05,dt));apply(best);let cost=score();
  if(cost>1e-8)for(let candidate=.12;candidate<=2.04;candidate+=.12){apply(candidate);const next=score();if(next<cost){best=candidate;cost=next;}if(next<1e-8)break;}
  this.curl=best;apply(best);
 }
}
