import * as T from 'three';
/** Separate fore/hind support drives the articulated trunk at every gait speed. */
export class StudyBodyMotion {
 private parts:{bone:T.Bone;rest:T.Quaternion;axes:T.Vector3[]}[]=[];
 private wheelBlend=0;private time=0;private pace=0;private load=0;private chestLoad=0;private tail:number[]=Array(6).fill(0);
 constructor(bones:Map<string,T.Bone>){
  for(const name of ['pelvis','chest','head',...Array.from({length:6},(_,i)=>'caudal'+i)]){
   const bone=bones.get(name)!;bone.updateWorldMatrix(true,false);const inv=bone.getWorldQuaternion(new T.Quaternion()).invert();
   this.parts.push({bone,rest:bone.quaternion.clone(),axes:[new T.Vector3(0,1,0),new T.Vector3(1,0,0),new T.Vector3(0,0,1)].map(a=>a.applyQuaternion(inv))});
  }
 }
 update(dt:number,speed:number,feet:{name:string;swing:boolean;progress:number;support?:number}[],sniff=false,reduced=false,reset=false,wheel=false){
  dt=T.MathUtils.clamp(dt,0,.1);
  if(reset||reduced){this.time=this.pace=this.load=this.chestLoad=0;this.tail.fill(0);}
  this.wheelBlend=reset?Number(wheel):T.MathUtils.lerp(this.wheelBlend,Number(wheel),1-Math.exp(-8*dt));
  if(reduced)dt=0;
  this.time+=dt;this.pace=T.MathUtils.lerp(this.pace,Math.min(1,speed/.65),1-Math.exp(-5*dt));
  let hind=0,front=0;for(const f of feet){const weight=(f.name.endsWith('L')?-1:1)*(f.support??(f.swing?Math.sin(Math.PI*f.progress):0));if(f.name.startsWith('hind'))hind+=weight;else front+=weight;}
  // Summing diagonal contacts cancels their signals: pelvis and chest must follow separate supports.
  this.load=T.MathUtils.lerp(this.load,hind,1-Math.exp(-14*dt));
  this.chestLoad=T.MathUtils.lerp(this.chestLoad,front,1-Math.exp(-12*dt));
  for(let i=0;i<this.parts.length;i++){
   const p=this.parts[i];let yaw=0,roll=0,pitch=0;
   if(i===0){yaw=this.load*.065;roll=this.load*.025;pitch=Math.sin(this.time*2)*.008;}
   else if(i===1){yaw=this.chestLoad*.045;roll=this.chestLoad*.016;pitch=Math.sin(this.time*2-.4)*.006;}
   else if(i===2){yaw=Math.sin(this.time*.7)*.065;pitch=sniff?-.10+Math.sin(this.time*16)*.018:Math.sin(this.time*1.2)*.015;}
   else {const j=i-3,target=j===0?-this.load*.08+Math.sin(this.time*2)*(.025+this.pace*.03):this.tail[j-1];this.tail[j]=T.MathUtils.lerp(this.tail[j],target,1-Math.exp(-(8-j*.7)*dt));yaw=this.tail[j];pitch=Math.sin(this.time*1.4-j*.45)*.006;}
   if(reduced)yaw=roll=pitch=0;
   if(i>=3){yaw*=1-this.wheelBlend*.92;pitch=pitch*(1-this.wheelBlend)-(i===3?1.6:i===6?.9:0)*this.wheelBlend;}
   p.bone.quaternion.copy(p.rest).multiply(new T.Quaternion().setFromAxisAngle(p.axes[0],yaw)).multiply(new T.Quaternion().setFromAxisAngle(p.axes[1],roll)).multiply(new T.Quaternion().setFromAxisAngle(p.axes[2],pitch));
  }
 }
}
