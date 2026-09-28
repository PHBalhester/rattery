import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';

const RINGS=90,SIDES=12,LENGTH=7.2,GIRTH=.3;
const ease=(t:number)=>t<.5?4*t*t*t:1-(-2*t+2)**3/2;
const clamp=T.MathUtils.clamp;

function scaleTexture(){
 const c=document.createElement('canvas');c.width=64;c.height=256;const g=c.getContext('2d')!;
 const grad=g.createLinearGradient(0,0,64,0);grad.addColorStop(0,'#d9cf9a');grad.addColorStop(.28,'#58613a');grad.addColorStop(.5,'#3d4528');grad.addColorStop(.72,'#58613a');grad.addColorStop(1,'#d9cf9a');
 g.fillStyle=grad;g.fillRect(0,0,64,256);
 for(let y=0;y<256;y+=32){g.fillStyle='rgba(20,22,10,.55)';g.beginPath();g.moveTo(32,y);g.lineTo(48,y+16);g.lineTo(32,y+32);g.lineTo(16,y+16);g.closePath();g.fill();g.fillStyle='rgba(200,190,120,.25)';g.fillRect(30,y+12,4,8);}
 for(let y=0;y<256;y+=6)for(let x=(y/6)%2*4;x<64;x+=8){g.strokeStyle='rgba(0,0,0,.18)';g.beginPath();g.arc(x,y,4,0,Math.PI);g.stroke();}
 const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;t.wrapS=t.wrapT=T.RepeatWrapping;return t;
}

/**
 * Season snake. The head follows a scripted route; every body ring samples the head's own trail by arc
 * length, so the body slides through exactly the same S-curves ("train on a track") instead of sliding
 * sideways. Below-floor parts are clipped, so it genuinely emerges from and returns into the den hole.
 */
export class SeasonSnake{
 readonly root=new T.Group();
 private body:T.Mesh<T.BufferGeometry,T.MeshStandardMaterial>;private head=new T.Group();private jaw:T.Object3D|null=null;private model:T.Object3D|null=null;
 private trail:T.Vector3[]=[];private route:T.CurvePath<T.Vector3>|null=null;private routeLength=0;
 private t=0;private active=false;private headPos=new T.Vector3();private map:T.Texture;
 private strikeDir=new T.Vector3();private approach=0;private total=0;
 onImpact:(()=>void)|null=null;private impacted=false;
 constructor(private den:T.Vector3){
  this.root.name='Season snake';this.map=scaleTexture();
  const g=new T.BufferGeometry();const n=(RINGS+1)*(SIDES+1);
  g.setAttribute('position',new T.BufferAttribute(new Float32Array(n*3),3).setUsage(T.DynamicDrawUsage));
  const uv=new Float32Array(n*2);for(let r=0;r<=RINGS;r++)for(let s=0;s<=SIDES;s++){uv[(r*(SIDES+1)+s)*2]=s/SIDES;uv[(r*(SIDES+1)+s)*2+1]=r/RINGS*6;}
  g.setAttribute('uv',new T.BufferAttribute(uv,2));
  const idx:number[]=[];for(let r=0;r<RINGS;r++)for(let s=0;s<SIDES;s++){const a=r*(SIDES+1)+s;idx.push(a,a+SIDES+1,a+1,a+1,a+SIDES+1,a+SIDES+2);}g.setIndex(idx);
  const clip=[new T.Plane(new T.Vector3(0,1,0),-.01)];
  this.body=new T.Mesh(g,new T.MeshStandardMaterial({map:this.map,roughness:.5,metalness:.05,clippingPlanes:clip}));this.body.castShadow=true;this.body.frustumCulled=false;
  this.root.add(this.body,this.head);this.root.visible=false;
  new GLTFLoader().load('/models/snake.glb',gltf=>{this.model=gltf.scene;this.jaw=gltf.scene.getObjectByName('SnakeJaw')??null;
   gltf.scene.traverse(o=>{if(o instanceof T.Mesh){o.castShadow=true;for(const m of Array.isArray(o.material)?o.material:[o.material])m.clippingPlanes=clip;}});this.head.add(gltf.scene);},undefined,()=>{});
 }
 get busy(){return this.active;}
 /** Head position in world space (for prey reactions). */
 get headWorld(){return this.headPos;}
 /** Scripts a strike on `target` (world point in front of a nest); `blocked` makes it recoil off a shield. */
 attack(target:T.Vector3,blocked:boolean){
  const d=this.den,to=target.clone().setY(.03),dir=to.clone().sub(d).setY(0),dist=dir.length();dir.normalize();
  const side=new T.Vector3(-dir.z,0,dir.x);
  const stop=to.clone().addScaledVector(dir,-2.4);
  const out=new T.CatmullRomCurve3([d.clone().setY(-1.2),d.clone().setY(.12),d.clone().addScaledVector(dir,dist*.3).addScaledVector(side,1.4).setY(.03),d.clone().addScaledVector(dir,dist*.62).addScaledVector(side,-1.1).setY(.03),stop],false,'centripetal');
  // U-turn loop, then home and back down the hole.
  const back=new T.CatmullRomCurve3([stop,stop.clone().addScaledVector(side,1.3).addScaledVector(dir,-.4),stop.clone().addScaledVector(side,.9).addScaledVector(dir,-2),d.clone().addScaledVector(dir,dist*.5).addScaledVector(side,1.6).setY(.03),d.clone().addScaledVector(dir,1).setY(.05),d.clone().setY(.03),d.clone().setY(-LENGTH-1.5)],false,'centripetal');
  const path=new T.CurvePath<T.Vector3>();path.add(out);path.add(back);
  this.route=path;this.routeLength=path.getLength();this.approach=out.getLength();this.strikeDir.copy(dir);
  this.trail=[];for(let i=0;i<=40;i++)this.trail.push(d.clone().setY(-1.2-LENGTH*(1-i/40)));
  this.t=0;this.active=true;this.impacted=false;this.root.visible=true;this.blocked=blocked;
  this.total=.6+Math.max(1.1,this.approach/12)+1.05+Math.max(1.5,(this.routeLength-this.approach)/8);
 }
 private blocked=false;
 update(dt:number){
  if(!this.active||!this.route)return;
  this.t+=dt;const travelOut=Math.max(1.1,this.approach/12),travelBack=Math.max(1.5,(this.routeLength-this.approach)/8);
  const tE=.6,tA=tE+travelOut,tS=tA+1.05,t=this.t;
  let s:number,lunge=0,rear=0,jaw=.08;
  if(t<tE){s=ease(t/tE)*1.7;}
  else if(t<tA){s=1.7+(this.approach-1.7)*ease((t-tE)/travelOut);}
  else if(t<tS){s=this.approach;const k=t-tA;
   // Anticipation (coil back, head up) then a <0.15s lunge, then recoil. Blocked strikes bounce off.
   if(k<.42){rear=Math.sin(k/.42*Math.PI/2)*.42;lunge=-.35*Math.sin(k/.42*Math.PI/2);jaw=.25;}
   else if(k<.56){const f=(k-.42)/.14;rear=.42*(1-f);lunge=-.35+1.55*(1-(1-f)**3)*(this.blocked?.55:1);jaw=.9;if(!this.impacted&&f>.8){this.impacted=true;this.onImpact?.();}}
   else{if(!this.impacted){this.impacted=true;this.onImpact?.();}const f=clamp((k-.56)/.49,0,1);lunge=(this.blocked?.5:1.2)*(1-ease(f))-(this.blocked?.25*Math.sin(f*Math.PI):0);rear=.25*Math.sin(f*Math.PI);jaw=.9*(1-f)+.1;}}
  else{s=this.approach+(this.routeLength-this.approach)*ease(clamp((t-tS)/travelBack,0,1));}
  if(t>=tS+travelBack+.3){this.active=false;this.root.visible=false;return;}
  // Lateral undulation is a function of distance travelled, so the trail itself holds the S-curve.
  const u=clamp(s/this.routeLength,0,1),p=this.route.getPointAt(u),tan=this.route.getTangentAt(u);
  const side=new T.Vector3(-tan.z,0,tan.x).normalize(),envelope=clamp((s-1.2)/1.2,0,1)*clamp((this.routeLength-s-1.5)/1.5,0,1);
  const wave=Math.sin(s/2.1*Math.PI*2)*.5*envelope;
  this.headPos.copy(p).addScaledVector(side,wave);
  const last=this.trail[this.trail.length-1];if(last.distanceTo(this.headPos)>.02)this.trail.push(this.headPos.clone());
  if(this.trail.length>900)this.trail.splice(0,this.trail.length-900);
  // Neck-only strike offset: the trail stays clean, the first rings blend towards the lunging head.
  const strike=this.strikeDir.clone().multiplyScalar(lunge).add(new T.Vector3(0,rear,0));
  this.writeBody(strike);
  const h=this.ringPoint(0,strike),n=this.ringPoint(.03,strike),fw=h.clone().sub(n).normalize();
  this.head.position.copy(h).add(new T.Vector3(0,.26,0));this.head.rotation.set(0,Math.atan2(fw.x,fw.z),0);this.head.rotateX(-Math.asin(clamp(fw.y,-1,1))-rear*.6);
  if(this.jaw)this.jaw.rotation.x=jaw*.7;
  this.head.scale.setScalar(1.75);
 }
 /** Point `f` (0 head .. 1 tail) along the body, sampled from the trail by arc length. */
 private ringPoint(f:number,strike:T.Vector3){
  const want=f*LENGTH;let acc=0;const tr=this.trail;let p=tr[tr.length-1].clone();
  for(let i=tr.length-1;i>0;i--){const seg=tr[i].distanceTo(tr[i-1]);if(acc+seg>=want){p=tr[i].clone().lerp(tr[i-1],(want-acc)/seg);break;}acc+=seg;if(i===1){p=tr[0].clone().setY(tr[0].y-(want-acc));}}
  const neck=Math.max(0,1-f/.22);return p.addScaledVector(strike,neck*neck);
 }
 private writeBody(strike:T.Vector3){
  const pos=this.body.geometry.attributes.position as T.BufferAttribute;const pts:T.Vector3[]=[];
  for(let r=0;r<=RINGS;r++)pts.push(this.ringPoint(r/RINGS,strike));
  const up=new T.Vector3(0,1,0),tan=new T.Vector3(),nrm=new T.Vector3(),bin=new T.Vector3();
  for(let r=0;r<=RINGS;r++){
   const f=r/RINGS,a=pts[Math.max(0,r-1)],b=pts[Math.min(RINGS,r+1)];tan.copy(a).sub(b).normalize();
   bin.crossVectors(tan,up);if(bin.lengthSq()<1e-6)bin.set(1,0,0);bin.normalize();nrm.crossVectors(bin,tan).normalize();
   const radius=GIRTH*(f<.08?.72+f/.08*.28:f>.7?Math.max(.08,1-(f-.7)/.3*.92):1);
   const c=pts[r].clone();c.y+=radius*.75;
   for(let s=0;s<=SIDES;s++){const ang=s/SIDES*Math.PI*2,x=Math.cos(ang)*radius,y=Math.sin(ang)*radius*.82;
    pos.setXYZ(r*(SIDES+1)+s,c.x+bin.x*x+nrm.x*y,c.y+bin.y*x+nrm.y*y,c.z+bin.z*x+nrm.z*y);}
  }
  pos.needsUpdate=true;this.body.geometry.computeVertexNormals();
 }
 cancel(){this.active=false;this.root.visible=false;}
 dispose(){this.body.geometry.dispose();this.body.material.dispose();this.map.dispose();this.model?.traverse(o=>{if(o instanceof T.Mesh){o.geometry.dispose();(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>m.dispose());}});this.root.removeFromParent();}
}
