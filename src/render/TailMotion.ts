import * as T from 'three';
/** Free lateral follow-through, with a raised curl inside an exercise wheel. */
export class TailMotion{
 private base:T.Bone;private tip:T.Bone;private rest:T.Quaternion[];private axes:T.Vector3[];
 private wheelBlend=0;private curlAxes:T.Vector3[];
 private lastYaw=0;private ready=false;private pace=0;private turn=0;private baseAngle=0;private tipAngle=0;private time=0;
 constructor(private model:T.Object3D,bones:Map<string,T.Bone>,private phase=0){
  const base=bones.get('tail'),tip=bones.get('tailtip')??bones.get('tail.tip')??bones.get('tail_tip');
  if(!base||!tip)throw Error('Missing tail chain');this.base=base;this.tip=tip;
  model.updateWorldMatrix(true,true);this.rest=[base.quaternion.clone(),tip.quaternion.clone()];
  this.curlAxes=[base,tip].map(b=>new T.Vector3(0,0,1).applyQuaternion(b.getWorldQuaternion(new T.Quaternion()).invert()).normalize());
  this.axes=[base,tip].map(b=>new T.Vector3(0,1,0).applyQuaternion(b.getWorldQuaternion(new T.Quaternion()).invert()).normalize());
 }
 update(dt:number,speed:number,reduced:boolean,reset:boolean,wheel=false){
  dt=Math.min(.05,Math.max(0,dt));const direction=new T.Vector3(1,0,0).applyQuaternion(this.model.getWorldQuaternion(new T.Quaternion()));
  const yaw=Math.atan2(direction.z,direction.x),delta=Math.atan2(Math.sin(yaw-this.lastYaw),Math.cos(yaw-this.lastYaw));
  const fresh=!this.ready||reset;this.lastYaw=yaw;this.ready=true;
  if(fresh||reduced){this.turn=this.pace=this.baseAngle=this.tipAngle=0;if(fresh)this.time=0;}
  if(!reduced){
   this.pace=T.MathUtils.lerp(this.pace,Math.min(1,Math.max(0,speed)/.7),1-Math.exp(-5*dt));
   this.turn=T.MathUtils.lerp(this.turn,fresh?0:T.MathUtils.clamp(delta/Math.max(dt,.001),-3,3),1-Math.exp(-6*dt));
   this.time+=dt*(1.7+this.pace*1.2);const t=this.time+this.phase;
   const target=Math.sin(t)*(.065+.16*this.pace)-this.turn*.13;
   this.baseAngle=T.MathUtils.lerp(this.baseAngle,T.MathUtils.clamp(target,-.38,.38),1-Math.exp(-7*dt));
   const tipTarget=this.baseAngle*.65+Math.sin(t-1.1)*(.12+.23*this.pace)-this.turn*.08;
   this.tipAngle=T.MathUtils.lerp(this.tipAngle,T.MathUtils.clamp(tipTarget,-.52,.52),1-Math.exp(-4.5*dt));
  }
  this.wheelBlend=fresh||reduced?Number(wheel):T.MathUtils.lerp(this.wheelBlend,Number(wheel),1-Math.exp(-8*dt));
  [this.base,this.tip].forEach((b,i)=>b.quaternion.copy(this.rest[i]).multiply(new T.Quaternion().setFromAxisAngle(this.axes[i],(i?this.tipAngle:this.baseAngle)*(1-this.wheelBlend*.92))).multiply(new T.Quaternion().setFromAxisAngle(this.curlAxes[i],-(i?.9:1.6)*this.wheelBlend)));
 }
}
