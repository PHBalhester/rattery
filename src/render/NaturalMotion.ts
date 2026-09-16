import * as T from 'three';
/** Cosmetic clock only: never consumes the biological simulation RNG. */
export class NaturalMotion {
 private head:T.Bone;private spine:T.Bone;private yawAxis:T.Vector3;private pitchAxis:T.Vector3;private spinePitch:T.Vector3;private up:T.Vector3;
 private time=0;private quiet=0;private yaw=0;private pitch=0;private sit=0;private lie=0;
 readonly blink={value:0};state='alert';
 constructor(model:T.Object3D,bones:Map<string,T.Bone>,private phase=0){
  this.head=bones.get('head')!;this.spine=bones.get('spine')!;model.updateWorldMatrix(true,true);
  const headInverse=this.head.getWorldQuaternion(new T.Quaternion()).invert();
  this.yawAxis=new T.Vector3(0,1,0).applyQuaternion(headInverse);this.pitchAxis=new T.Vector3(0,0,1).applyQuaternion(headInverse);
  this.spinePitch=new T.Vector3(0,0,1).applyQuaternion(this.spine.getWorldQuaternion(new T.Quaternion()).invert());
  this.up=new T.Vector3(0,1,0).applyQuaternion(this.spine.parent!.getWorldQuaternion(new T.Quaternion()).invert());
 }
 update(dt:number,active:boolean,reduced:boolean,reset:boolean){
  dt=T.MathUtils.clamp(dt,0,.05);
  if(reset||reduced){this.time=this.quiet=this.yaw=this.pitch=this.sit=this.lie=0;this.blink.value=0;this.state='alert';return;}
  this.time+=dt;this.quiet=active?0:this.quiet+dt;
  const cycle=(this.time+this.phase*7)%42;
  this.state=active?'alert':cycle<8?'look':cycle<15?'sniff':cycle<25&&this.quiet>3?'sit':cycle<37&&this.quiet>6?'lie':'look';
  const blend=1-Math.exp(-5*dt),restBlend=1-Math.exp(-(active?9:2.5)*dt);
  this.sit=T.MathUtils.lerp(this.sit,this.state==='sit'?1:0,restBlend);
  this.lie=T.MathUtils.lerp(this.lie,this.state==='lie'?1:0,restBlend);
  const sniff=this.state==='sniff';
  const yawTarget=Math.sin(this.time*.8+this.phase)*(active?.025:this.state==='look'?.25:.07);
  const pitchTarget=sniff?-.20+Math.sin(this.time*17)*.026:this.state==='look'?-.06-.08*Math.sin(this.time*.53+this.phase):-.10*this.lie;
  this.yaw=T.MathUtils.lerp(this.yaw,yawTarget,blend);this.pitch=T.MathUtils.lerp(this.pitch,pitchTarget,blend);
  this.spine.position.addScaledVector(this.up,-.045*this.sit-.095*this.lie);
  this.spine.quaternion.multiply(new T.Quaternion().setFromAxisAngle(this.spinePitch,.12*this.sit));
  this.head.quaternion.multiply(new T.Quaternion().setFromAxisAngle(this.yawAxis,this.yaw)).multiply(new T.Quaternion().setFromAxisAngle(this.pitchAxis,this.pitch-.08*this.sit));
  const blinkPhase=(this.time+this.phase*1.7)%(3.4+this.phase*.31);
  this.blink.value=blinkPhase<.19?Math.sin(Math.PI*blinkPhase/.19)**2:0;
 }
 diagnostics(){return {state:this.state,sit:this.sit,lie:this.lie,yaw:this.yaw,pitch:this.pitch,blink:this.blink.value};}
}
