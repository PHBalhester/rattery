import * as T from 'three';
export type Ground=(x:number,z:number)=>number;
type Leg={name:string;upper:T.Bone;lower:T.Bone;foot:T.Bone;rest:T.Quaternion[];home:T.Vector3;pole:T.Vector3;footRotation:T.Quaternion;anchor:T.Vector3;from:T.Vector3;to:T.Vector3;rotation:T.Quaternion;startRotation:T.Quaternion;endRotation:T.Quaternion;progress:number;duration:number;swing:boolean};
const V=()=>new T.Vector3();
/** Two-segment analytical IK. The pole preserves the anatomical knee/elbow side. */
export function kneeTarget(hip:T.Vector3,target:T.Vector3,pole:T.Vector3,a:number,b:number){
 const direction=target.clone().sub(hip),distance=T.MathUtils.clamp(direction.length(),Math.abs(a-b)+1e-5,a+b-1e-5);direction.normalize();
 if(!direction.lengthSq())direction.set(0,-1,0);
 const bend=pole.clone().addScaledVector(direction,-pole.dot(direction));
 if(bend.lengthSq()<1e-8){bend.set(Math.abs(direction.x)>.9?0:1,Math.abs(direction.x)>.9?1:0,0);bend.addScaledVector(direction,-bend.dot(direction));}
 bend.normalize();const along=(a*a-b*b+distance*distance)/(2*distance),height=Math.sqrt(Math.max(0,a*a-along*along));
 return {knee:hip.clone().addScaledVector(direction,along).addScaledVector(bend,height),ankle:hip.clone().addScaledVector(direction,distance)};
}
function aim(bone:T.Bone,child:T.Bone,target:T.Vector3){
 const origin=bone.getWorldPosition(V()),current=child.getWorldPosition(V()).sub(origin).normalize(),desired=target.clone().sub(origin).normalize();
 const world=bone.getWorldQuaternion(new T.Quaternion()).premultiply(new T.Quaternion().setFromUnitVectors(current,desired));
 bone.quaternion.copy(bone.parent!.getWorldQuaternion(new T.Quaternion()).invert().multiply(world));bone.updateWorldMatrix(false,true);
}
export class FootMotor{
 private legs:Leg[]=[];private ready=false;private last=V();private velocity=V();private turn=0;private fast=false;private batch=new Set<string>();
 constructor(private model:T.Object3D,bones:Map<string,T.Bone>){
  model.updateWorldMatrix(true,true);const inverse=model.getWorldQuaternion(new T.Quaternion()).invert();
  const bone=(name:string)=>bones.get(name)??bones.get(name.replace(/\./g,'_'))??bones.get(name.replace(/\./g,''));
  for(const name of ['hind.L','front.L','hind.R','front.R']){
   const upper=bone(name+'.upper'),lower=bone(name+'.lower'),foot=bone(name+'.foot');if(!upper||!lower||!foot)throw Error('Missing leg chain '+name);
   const hip=model.worldToLocal(upper.getWorldPosition(V())),knee=model.worldToLocal(lower.getWorldPosition(V())),home=model.worldToLocal(foot.getWorldPosition(V()));
   const axis=home.clone().sub(hip).normalize(),pole=knee.clone().sub(hip);pole.addScaledVector(axis,-pole.dot(axis)).normalize();
   this.legs.push({name,upper,lower,foot,rest:[upper.quaternion.clone(),lower.quaternion.clone(),foot.quaternion.clone()],home,pole,footRotation:inverse.clone().multiply(foot.getWorldQuaternion(new T.Quaternion())),anchor:V(),from:V(),to:V(),rotation:new T.Quaternion(),startRotation:new T.Quaternion(),endRotation:new T.Quaternion(),progress:0,duration:.18,swing:false});
  }
 }
 update(dt:number,ground:Ground,reduced:boolean,reset:boolean,treadmill=0){
  dt=Math.min(.05,Math.max(0,dt));
  for(const l of this.legs){l.upper.quaternion.copy(l.rest[0]);l.lower.quaternion.copy(l.rest[1]);l.foot.quaternion.copy(l.rest[2]);}
  this.model.updateWorldMatrix(true,true);
  const center=this.model.getWorldPosition(V()),bodyScale=this.model.getWorldScale(V()).y;
  const parentRotation=this.model.parent!.getWorldQuaternion(new T.Quaternion());
  const fwd=new T.Vector3(1,0,0).applyQuaternion(parentRotation),side=new T.Vector3(0,0,1).applyQuaternion(parentRotation),probe=.4*bodyScale;
  const slope=(axis:T.Vector3)=>(ground(center.x+axis.x*probe,center.z+axis.z*probe)-ground(center.x-axis.x*probe,center.z-axis.z*probe))/(2*probe);
  const blend=reset||!this.ready?1:1-Math.exp(-12*dt);
  this.model.rotation.z=T.MathUtils.lerp(this.model.rotation.z,treadmill>0?0:T.MathUtils.clamp(Math.atan(slope(fwd)),-.3,.3),blend);
  this.model.rotation.x=T.MathUtils.lerp(this.model.rotation.x,treadmill>0?0:T.MathUtils.clamp(-Math.atan(slope(side)),-.2,.2),blend);
  this.model.updateWorldMatrix(true,true);
  const origin=this.model.getWorldPosition(V()),scale=this.model.getWorldScale(V()).y,orientation=this.model.getWorldQuaternion(new T.Quaternion());
  const teleport=!this.ready||reset||origin.distanceTo(this.last)>scale*.8;
  const speed=dt>0&&!teleport?origin.clone().sub(this.last).divideScalar(dt):V();speed.y=0;
  this.velocity.lerp(speed,1-Math.exp(-14*dt));this.last.copy(origin);
  const forward=new T.Vector3(1,0,0).transformDirection(this.model.matrixWorld);
  const travel=treadmill>0?forward.clone().multiplyScalar(treadmill):this.velocity;
  const nominal=(l:Leg,lead=0)=>{const p=this.model.localToWorld(l.home.clone());p.addScaledVector(travel,lead);p.y=ground(p.x,p.z)+l.home.y*scale;return p;};
  if(teleport||reduced){for(const l of this.legs){l.anchor.copy(nominal(l));l.rotation.copy(orientation).multiply(l.footRotation);l.swing=false;}this.ready=true;}
  if(!reduced&&!teleport){
   for(const l of this.legs)if(!l.swing&&treadmill)l.anchor.addScaledVector(forward,-treadmill*dt);
   // A walking step lifts one paw at a time; the other three retain their world anchors.
   this.fast=travel.length()>(this.fast?.45:.60)*scale;
   const airborne=this.legs.filter(l=>l.swing),quick=this.fast;if(!airborne.length)this.batch.clear();
   if(airborne.length<(quick?2:1)){
    let chosen:Leg|undefined,error=.055*scale;
    for(let n=0;n<4;n++){const l=this.legs[(this.turn+n)%4];if(l.swing||this.batch.has(l.name)||airborne.some(a=>a.name.split('.')[0]===l.name.split('.')[0]||a.name.split('.')[1]===l.name.split('.')[1]))continue;const d=nominal(l).distanceTo(l.anchor);if(d>error){error=d;chosen=l;}}
    if(chosen){const l=chosen;this.batch.add(l.name);l.swing=true;l.progress=0;l.duration=T.MathUtils.clamp((quick?.075:.14)*scale/Math.max(.25*scale,travel.length()),.065,.18);l.from.copy(l.anchor);l.to.copy(nominal(l,Math.min(.10,.09*scale/Math.max(.001,travel.length()))));l.startRotation.copy(l.rotation);l.endRotation.copy(orientation).multiply(l.footRotation);this.turn=(this.legs.indexOf(l)+1)%4;}
   }
  }
  for(const l of this.legs){
   if(l.swing){l.progress=Math.min(1,l.progress+dt/l.duration);const t=l.progress,e=t*t*t*(10+t*(-15+6*t));l.anchor.lerpVectors(l.from,l.to,e);l.anchor.y+=Math.sin(Math.PI*t)**2*.045*scale;l.rotation.slerpQuaternions(l.startRotation,l.endRotation,e);if(t>=1)l.swing=false;}
   const hip=l.upper.getWorldPosition(V()),knee=l.lower.getWorldPosition(V()),ankle=l.foot.getWorldPosition(V());
   const solved=kneeTarget(hip,l.anchor,l.pole.clone().transformDirection(this.model.matrixWorld),hip.distanceTo(knee),knee.distanceTo(ankle));
   aim(l.upper,l.lower,solved.knee);aim(l.lower,l.foot,solved.ankle);
   l.foot.quaternion.copy(l.foot.parent!.getWorldQuaternion(new T.Quaternion()).invert().multiply(l.rotation));l.foot.updateWorldMatrix(false,true);
  }
 }
 diagnostics(){return this.legs.map(l=>({name:l.name,swing:l.swing,progress:l.progress,target:l.anchor.toArray(),actual:l.foot.getWorldPosition(V()).toArray()}));}
}
