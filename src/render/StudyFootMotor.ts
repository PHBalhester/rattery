import * as T from 'three';
export type Ground=(x:number,z:number)=>number;
type Leg={contact:number;support:number;name:string;upper:T.Bone;lower:T.Bone;foot:T.Bone;rest:T.Quaternion[];home:T.Vector3;pole:T.Vector3;footRotation:T.Quaternion;anchor:T.Vector3;from:T.Vector3;to:T.Vector3;rotation:T.Quaternion;startRotation:T.Quaternion;endRotation:T.Quaternion;cycle:number;progress:number;duration:number;swing:boolean};
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
export class StudyFootMotor{
 private previousOrientation=new T.Quaternion();private previousForward=new T.Vector3(1,0,0);private fast=false;private batch=new Set<string>();private phase=0;private legs:Leg[]=[];private ready=false;private last=V();private velocity=V();
 constructor(private model:T.Object3D,bones:Map<string,T.Bone>){
  model.updateWorldMatrix(true,true);const inverse=model.getWorldQuaternion(new T.Quaternion()).invert();
  const bone=(name:string)=>bones.get(name)??bones.get(name.replace(/\./g,'_'))??bones.get(name.replace(/\./g,''));
  for(const name of ['hind.L','front.L','hind.R','front.R']){
   const upper=bone(name+'.upper'),lower=bone(name+'.lower'),foot=bone(name+'.foot');if(!upper||!lower||!foot)throw Error('Missing leg chain '+name);
   const hip=model.worldToLocal(upper.getWorldPosition(V())),knee=model.worldToLocal(lower.getWorldPosition(V())),home=model.worldToLocal(foot.getWorldPosition(V()));
   const axis=home.clone().sub(hip).normalize(),pole=knee.clone().sub(hip);pole.addScaledVector(axis,-pole.dot(axis)).normalize();
   this.legs.push({contact:0,support:0,name,upper,lower,foot,rest:[upper.quaternion.clone(),lower.quaternion.clone(),foot.quaternion.clone()],home,pole,footRotation:inverse.clone().multiply(foot.getWorldQuaternion(new T.Quaternion())),anchor:V(),from:V(),to:V(),rotation:new T.Quaternion(),startRotation:new T.Quaternion(),endRotation:new T.Quaternion(),cycle:-1,progress:0,duration:.18,swing:false});
  }
 }
 update(dt:number,ground:Ground,reduced:boolean,reset:boolean,treadmill=0){
  dt=Math.min(.1,Math.max(0,dt));
  for(const l of this.legs){l.support=0;l.upper.quaternion.copy(l.rest[0]);l.lower.quaternion.copy(l.rest[1]);l.foot.quaternion.copy(l.rest[2]);}
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
  const previousOrigin=this.last.clone();
  const speed=dt>0&&!teleport?origin.clone().sub(this.last).divideScalar(dt):V();speed.y=0;
  this.velocity.lerp(speed,1-Math.exp(-14*dt));this.last.copy(origin);
  const forward=new T.Vector3(1,0,0).transformDirection(this.model.matrixWorld);
  const turnRate=!teleport&&dt>0?forward.angleTo(this.previousForward)/dt:0;const turning=turnRate>.8;this.previousForward.copy(forward);
  const travel=treadmill>0?forward.clone().multiplyScalar(treadmill):this.velocity;
  let fraction=1;const stepOrientation=orientation.clone(),rotationDelta=new T.Quaternion();
  const offsets=new Map(this.legs.map(l=>[l,this.model.localToWorld(l.home.clone()).sub(origin)]));
  const nominal=(l:Leg,lead=0)=>{const p=offsets.get(l)!.clone().applyQuaternion(rotationDelta).add(previousOrigin.clone().lerp(origin,fraction));p.addScaledVector(travel,lead);p.y=ground(p.x,p.z)+l.home.y*scale;return p;};
  if(teleport||reduced){for(const l of this.legs){l.anchor.copy(nominal(l));l.rotation.copy(orientation).multiply(l.footRotation);l.swing=false;}this.ready=true;if(teleport){this.phase=0;this.fast=false;this.batch.clear();this.velocity.set(0,0,0);for(const l of this.legs)l.cycle=-1;}}
  // Subdivide contact timing and interpolate travel at low FPS; solve bone IK
  // only once per rendered frame. Contact IDs distinguish a completed unseen step
  // from sliding on the same planted contact. Support is averaged for the trunk.
  const steps=teleport||reduced?1:Math.max(1,Math.ceil(dt/(1/30))),stepDt=dt/steps;
  for(let step=1;step<=steps;step++){
   fraction=teleport?1:step/steps;
   stepOrientation.copy(teleport?orientation:this.previousOrientation).slerp(orientation,fraction);
   rotationDelta.copy(stepOrientation).multiply(orientation.clone().invert());
  if(!reduced&&!teleport){
   for(const l of this.legs)if(!l.swing&&treadmill)l.anchor.addScaledVector(forward,-treadmill*stepDt);
   const velocity=Math.max(travel.length(),turnRate*.7*scale);
   this.fast=turning||velocity>(this.fast?.45:.60)*scale;
   if(this.fast)for(const l of this.legs)if(l.swing)l.duration=Math.min(l.duration,T.MathUtils.clamp(.075*scale/Math.max(.25*scale,velocity),.065,.18));
   const cadence=velocity/(.24*scale),stance=.64;
   if(velocity>.025*scale)this.phase+=stepDt*cadence;
   if(!this.legs.some(l=>l.swing))this.batch.clear();
   const order=this.legs.map((l,i)=>({i,d:nominal(l).distanceTo(l.anchor)}));if(this.fast)order.sort((a,b)=>b.d-a.d);
   for(const {i} of order){
    const l=this.legs[i],phase=this.phase+[0,.25,.5,.75][i],cycle=Math.floor(phase),fraction=phase-cycle;
    const displaced=nominal(l).distanceTo(l.anchor),airborne=this.legs.filter(a=>a.swing);
    const due=this.fast?displaced>.055*scale&&!this.batch.has(l.name):velocity>.025*scale&&fraction>=stance&&l.cycle!==cycle||displaced>.19*scale;
    const compatible=!this.fast||!airborne.some(a=>a.name.split('.')[0]===l.name.split('.')[0]||a.name.split('.')[1]===l.name.split('.')[1]);
    if(!l.swing&&airborne.length<2&&compatible&&due){
     this.batch.add(l.name);l.contact++;l.cycle=cycle;l.swing=true;l.progress=0;
     l.duration=this.fast?T.MathUtils.clamp(.075*scale/Math.max(.25*scale,velocity),.065,.18):T.MathUtils.clamp((1-fraction)/Math.max(.8,cadence),stepDt,.32);
     const lead=this.fast?Math.min(.10,.09*scale/Math.max(.001,velocity)):Math.min(.22,(stance*.5)/Math.max(.8,cadence));
     l.from.copy(l.anchor);l.to.copy(nominal(l,lead));
     l.startRotation.copy(l.rotation);l.endRotation.copy(stepOrientation).multiply(l.footRotation);
     if(this.fast)break;
    }
   }
  }

  for(const l of this.legs){
   if(l.swing){if(turning)l.to.lerp(nominal(l),1-Math.exp(-14*stepDt));l.progress=Math.min(1,l.progress+stepDt/l.duration);const t=l.progress,e=t*t*t*(10+t*(-15+6*t));l.anchor.lerpVectors(l.from,l.to,e);l.anchor.y+=Math.sin(Math.PI*t)**2*.045*scale;l.rotation.slerpQuaternions(l.startRotation,l.endRotation,e);const roll=new T.Quaternion().setFromAxisAngle(new T.Vector3(0,0,1).applyQuaternion(stepOrientation),-.13*Math.sin(2*Math.PI*t)*Math.sin(Math.PI*t));l.rotation.premultiply(roll);if(t>=1)l.swing=false;}
   l.support+=(l.swing?Math.sin(Math.PI*l.progress):0)/steps;
  }
  }
  for(const l of this.legs){
   const hip=l.upper.getWorldPosition(V()),knee=l.lower.getWorldPosition(V()),ankle=l.foot.getWorldPosition(V());
   const solved=kneeTarget(hip,l.anchor,l.pole.clone().transformDirection(this.model.matrixWorld),hip.distanceTo(knee),knee.distanceTo(ankle));
   aim(l.upper,l.lower,solved.knee);aim(l.lower,l.foot,solved.ankle);
   l.foot.quaternion.copy(l.foot.parent!.getWorldQuaternion(new T.Quaternion()).invert().multiply(l.rotation));l.foot.updateWorldMatrix(false,true);
  }
  this.previousOrientation.copy(orientation);
 }
 diagnostics(){return this.legs.map(l=>({name:l.name,contact:l.contact,support:l.support,swing:l.swing,progress:l.progress,target:l.anchor.toArray(),actual:l.foot.getWorldPosition(V()).toArray()}));}
}
