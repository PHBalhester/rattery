import * as T from 'three';
type Support={name:string;swing:boolean;progress:number};
/** Weight follows actual paw support; applied before IK so planted feet stay anchored. */
export class BodyMotion {
 private spine:T.Bone;private head:T.Bone;private position:T.Vector3;private rest:T.Quaternion;private headRest:T.Quaternion;
 private axes:T.Vector3[];private offsetAxis:T.Vector3;private sideAxis:T.Vector3;
 private weight=0;private compression=0;private neck=0;private time=0;
 private pitch=0;private neckPitch=0;private pace=0;private turn=0;private lastYaw=0;private ready=false;private headAxes:T.Vector3[];private restScale:T.Vector3;
 constructor(private model:T.Object3D,bones:Map<string,T.Bone>){
  this.spine=bones.get('spine')!;this.head=bones.get('head')!;
  this.restScale=this.spine.scale.clone();this.position=this.spine.position.clone();this.rest=this.spine.quaternion.clone();this.headRest=this.head.quaternion.clone();
  model.updateWorldMatrix(true,true);
  const inv=this.spine.getWorldQuaternion(new T.Quaternion()).invert();
  this.axes=[new T.Vector3(0,1,0),new T.Vector3(1,0,0),new T.Vector3(0,0,1)].map(v=>v.applyQuaternion(inv));
  const headInverse=this.head.getWorldQuaternion(new T.Quaternion()).invert();
  this.headAxes=[new T.Vector3(0,1,0),new T.Vector3(0,0,1)].map(v=>v.applyQuaternion(headInverse));
  const parentInverse=this.spine.parent!.getWorldQuaternion(new T.Quaternion()).invert();
  this.offsetAxis=new T.Vector3(0,1,0).applyQuaternion(parentInverse);
  this.sideAxis=new T.Vector3(0,0,1).applyQuaternion(parentInverse);
 }
 update(dt:number,feet:Support[],reduced:boolean,reset:boolean,speed=0){
  dt=T.MathUtils.clamp(dt,0,.05);
  const direction=new T.Vector3(1,0,0).applyQuaternion(this.model.getWorldQuaternion(new T.Quaternion()));
  const yaw=Math.atan2(direction.z,direction.x),delta=Math.atan2(Math.sin(yaw-this.lastYaw),Math.cos(yaw-this.lastYaw));
  const fresh=reset||!this.ready;this.ready=true;this.lastYaw=yaw;
  if(fresh||reduced){this.weight=this.compression=this.neck=0;this.time=0;this.pitch=this.neckPitch=this.pace=this.turn=0;}
  else {
   this.time+=dt;let lateral=0,down=0,foreAft=0;
   const previousPace=this.pace;
   this.pace=T.MathUtils.lerp(this.pace,T.MathUtils.clamp(speed/.7,0,1),1-Math.exp(-4*dt));
   this.turn=T.MathUtils.lerp(this.turn,T.MathUtils.clamp(delta/Math.max(dt,.001),-1.5,1.5),1-Math.exp(-5*dt));
   for(const f of feet)if(f.swing){const load=Math.sin(Math.PI*f.progress);lateral+=(f.name.endsWith('L')?-1:1)*load*(f.name.startsWith('hind')?1:.7);down+=load;foreAft+=(f.name.startsWith('hind')?1:-1)*load;}
   this.weight=T.MathUtils.lerp(this.weight,lateral,1-Math.exp(-10*dt));
   this.compression=T.MathUtils.lerp(this.compression,down,1-Math.exp(-12*dt));
   const acceleration=dt>0?T.MathUtils.clamp((this.pace-previousPace)/dt,-1,1):0;
   this.pitch=T.MathUtils.lerp(this.pitch,foreAft*.026-acceleration*.012,1-Math.exp(-8*dt));
   this.neckPitch=T.MathUtils.lerp(this.neckPitch,this.pitch,1-Math.exp(-5*dt));
   this.neck=T.MathUtils.lerp(this.neck,this.weight,1-Math.exp(-5*dt));
  }
  const balance=1/(1+Math.abs(this.turn)*4);
  const breath=reduced?0:Math.sin(this.time*2.1)*.003;
  this.spine.position.copy(this.position).addScaledVector(this.offsetAxis,breath-this.compression*.006).addScaledVector(this.sideAxis,this.weight*.014*balance);
  this.spine.quaternion.copy(this.rest).multiply(new T.Quaternion().setFromAxisAngle(this.axes[0],(this.weight*.045-this.turn*.008)*balance)).multiply(new T.Quaternion().setFromAxisAngle(this.axes[1],(this.weight*.028+this.turn*.012)*balance)).multiply(new T.Quaternion().setFromAxisAngle(this.axes[2],this.pitch*balance));
  this.head.quaternion.copy(this.headRest).multiply(new T.Quaternion().setFromAxisAngle(this.headAxes[0],-this.neck*.03)).multiply(new T.Quaternion().setFromAxisAngle(this.headAxes[1],-this.neckPitch*.7));
  this.spine.scale.copy(this.restScale).multiplyScalar(1+(reduced?0:Math.sin(this.time*2.1)*.002));
 }
}
