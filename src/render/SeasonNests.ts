import * as T from 'three';
import {NEST_DESIGNS,visualTier,type NestId,type VisualEvent} from '../season/visualState';
import type {BlenderRatAssets,BlenderRatVisual} from './BlenderRat';

type NestView={root:T.Group;layers:T.Group[];flag:T.Mesh<T.PlaneGeometry,T.MeshStandardMaterial>;flagBase:Float32Array;label:T.Sprite;labelCanvas:HTMLCanvasElement;labelMap:T.CanvasTexture;score:number;tier:number;growth:number;halo:T.Mesh;shield:T.Mesh<T.SphereGeometry,T.MeshPhysicalMaterial>;crown:T.Group;snake:T.Group;food:T.Group;event:VisualEvent['kind']|null;eventAt:number;rats:BlenderRatVisual[]};
const clamp=T.MathUtils.clamp;
const noise=(n:number)=>{const v=Math.sin(n*127.1+31.7)*43758.5453;return v-Math.floor(v);};
function canvas(w:number,h:number){const c=document.createElement('canvas');c.width=w;c.height=h;return c;}
function flagTexture(company:string,ticker:string,color:string){
 const c=canvas(512,288),g=c.getContext('2d')!;g.fillStyle=color;g.fillRect(0,0,512,288);
 g.strokeStyle='#ffffff77';g.lineWidth=3;g.strokeRect(16,16,480,256);g.fillStyle='#14201a';g.font='bold 76px Georgia';g.textAlign='center';g.fillText(company,256,134);g.font='bold 28px sans-serif';g.fillText(ticker+'  /  RATTERY',256,205);
 const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;return t;
}
function archGeometry(){
 const v:number[]=[],ix:number[]=[];
 for(let i=0;i<=24;i++){const a=i/24*Math.PI;for(const z of [-1.8,1.8])v.push(Math.cos(a)*2.5,1.0+Math.sin(a)*1.85,z);}
 for(let i=0;i<24;i++){const a=i*2;ix.push(a,a+1,a+2,a+1,a+3,a+2);}
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(v,3));g.setIndex(ix);g.computeVertexNormals();return g;
}

/** Cosmetic presentation only. Its six mascots never enter World.rats or ownership state. */
export class SeasonNests{
 readonly root=new T.Group();
 private nests=new Map<NestId,NestView>();private textures:T.Texture[]=[];
 private time=0;private serial=0;private revealSerial=-1;private winner:NestId|null=null;private revealAt=-100;
 private burst:T.Points<T.BufferGeometry,T.PointsMaterial>;
 private readonly budget=192;
 constructor(scene:T.Scene,width:number,height:number){
  this.root.name='Season nest visual preview';scene.add(this.root);
  const wood=new T.MeshStandardMaterial({color:'#916641',roughness:.9});
  const straw=new T.MeshStandardMaterial({color:'#c4a570',roughness:1});
  const dark=new T.MeshStandardMaterial({color:'#3b2c21',roughness:.95});
  const gold=new T.MeshStandardMaterial({color:'#ebc265',metalness:.65,roughness:.28});
  for(const design of NEST_DESIGNS){
   const root=new T.Group();root.name=`${design.id} nest ${design.letter}`;root.position.set(-(design.anchor[0]*width-width/2)/30,-.04,-(design.anchor[1]*height-height/2)/30);root.rotation.y=Math.PI;this.root.add(root);
   const team=new T.MeshStandardMaterial({color:design.color,roughness:.72});
   const add=(parent:T.Object3D,geo:T.BufferGeometry,mat:T.Material,x=0,y=0,z=0)=>{const m=new T.Mesh(geo,mat);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;};
   add(root,new T.CylinderGeometry(3.35,3.65,.3,40),dark,0,.02);
   add(root,new T.CylinderGeometry(3.2,3.2,.15,40),straw,0,.2);
   const rim=add(root,new T.TorusGeometry(3.14,.18,6,48),team,0,.32);rim.rotation.x=Math.PI/2;
   for(let i=0;i<26;i++){const a=i/26*Math.PI*2;const twig=add(root,new T.CylinderGeometry(.055,.065,1.25,5),wood,Math.cos(a)*2.8,.35,Math.sin(a)*2.8);twig.rotation.set(Math.PI/2,0,a+.6);}
   const layers=[new T.Group(),new T.Group(),new T.Group()];layers.forEach(g=>root.add(g));
   // Stage 1: an open arched shelter; stage 2: porch and side stores; stage 3: raised standards and trim.
   add(layers[0],archGeometry(),new T.MeshStandardMaterial({color:design.dark,roughness:.86,side:T.DoubleSide}));
   for(const x of [-2.4,2.4])add(layers[0],new T.BoxGeometry(.18,1.2,3.8),wood,x,.65);
   for(const x of [-1.8,1.8]){
    add(layers[1],new T.CylinderGeometry(.1,.13,2.7,8),wood,x,1.5,2.1);
    const roof=add(layers[1],new T.BoxGeometry(2.1,.15,1.7),team,x*.5,2.85,2.25);roof.rotation.x=-.12;
    add(layers[1],new T.CylinderGeometry(.48,.54,.55,12),straw,x,.55,-2);
   }
   for(let i=0;i<5;i++)add(layers[1],new T.BoxGeometry(3.8,.1,.26),wood,0,.35,1.9+i*.3);
   for(const x of [-2.6,2.6]){
    add(layers[2],new T.CylinderGeometry(.16,.2,3.65,10),gold,x,1.9,-1.2);
    add(layers[2],new T.SphereGeometry(.27,10,8),team,x,3.95,-1.2);
   }
   const trim=add(layers[2],new T.TorusGeometry(3.4,.065,6,48),gold,0,.56);trim.rotation.x=Math.PI/2;
   const halo=add(root,new T.RingGeometry(3.5,3.7,48),new T.MeshBasicMaterial({color:design.color,transparent:true,opacity:0,side:T.DoubleSide,depthWrite:false}),0,.05);halo.rotation.x=-Math.PI/2;
   const flagMap=flagTexture(design.company,design.id,design.color);this.textures.push(flagMap);
   add(root,new T.CylinderGeometry(.06,.09,6.1,8),gold,2.7,3.1,-1.7);
   add(root,new T.SphereGeometry(.16,10,8),gold,2.7,6.22,-1.7);
   const flagGeo=new T.PlaneGeometry(3.4,1.9,16,8);flagGeo.translate(1.7,0,0);
   const flag=new T.Mesh(flagGeo,new T.MeshStandardMaterial({map:flagMap,roughness:.8,side:T.DoubleSide}));flag.position.set(2.7,5.05,-1.7);flag.castShadow=true;root.add(flag);
   const labelCanvas=canvas(512,160),labelMap=new T.CanvasTexture(labelCanvas);labelMap.colorSpace=T.SRGBColorSpace;this.textures.push(labelMap);
   const label=new T.Sprite(new T.SpriteMaterial({map:labelMap,depthTest:false,transparent:true}));label.scale.set(5,1.55,1);label.position.set(0,.15,5.1);root.add(label);
   const shield=new T.Mesh(new T.SphereGeometry(3.7,24,12,0,Math.PI*2,0,Math.PI/2),new T.MeshPhysicalMaterial({color:design.color,transparent:true,opacity:.2,roughness:.1,metalness:.1,side:T.DoubleSide,depthWrite:false}));shield.position.y=.1;shield.visible=false;root.add(shield);
   const crown=new T.Group();crown.position.set(0,4.3,0);root.add(crown);crown.visible=false;
   const crownRim=add(crown,new T.TorusGeometry(.9,.11,8,24),gold);crownRim.rotation.x=Math.PI/2;
   for(let i=0;i<5;i++){const a=i/5*Math.PI*2;const spike=add(crown,new T.ConeGeometry(.2,.7,4),gold,Math.cos(a)*.85,.3,Math.sin(a)*.85);spike.rotation.y=a;add(crown,new T.SphereGeometry(.1,8,6),team,Math.cos(a)*.85,.7,Math.sin(a)*.85);}
   const food=new T.Group();food.visible=false;root.add(food);
   for(let i=0;i<5;i++)add(food,new T.SphereGeometry(.11,8,6),straw,(i-2)*.16,0,noise(i)*.3);
   const snake=new T.Group();snake.visible=false;root.add(snake);
   const curve=new T.CatmullRomCurve3(Array.from({length:14},(_,i)=>new T.Vector3((i/13-.5)*2.6,.14,Math.sin(i*.8)*.22)));
   add(snake,new T.TubeGeometry(curve,24,.09,5,false),new T.MeshStandardMaterial({color:'#74382d',roughness:.65}));add(snake,new T.SphereGeometry(.15,10,8),dark,1.3,.16,Math.sin(13*.8)*.22);
   const view:NestView={root,layers,flag,flagBase:(flagGeo.attributes.position.array as Float32Array).slice(),label,labelCanvas,labelMap,score:-1,tier:0,growth:0,halo,shield,crown,snake,food,event:null,eventAt:-100,rats:[]};
   this.nests.set(design.id,view);this.setScore(design.id,0);
  }
  const geo=new T.BufferGeometry();geo.setAttribute('position',new T.BufferAttribute(new Float32Array(this.budget*3),3));geo.setAttribute('color',new T.BufferAttribute(new Float32Array(this.budget*3),3));
  this.burst=new T.Points(geo,new T.PointsMaterial({size:.13,vertexColors:true,transparent:true,opacity:.9,depthWrite:false,blending:T.AdditiveBlending}));this.burst.frustumCulled=false;this.burst.visible=false;this.root.add(this.burst);
 }
 attachRats(assets:BlenderRatAssets){
  for(const design of NEST_DESIGNS){const view=this.nests.get(design.id)!;if(view.rats.length)continue;
   for(let i=0;i<2;i++){const rat=assets.create(`preview-${design.id}-${i}`,undefined,design.color);rat.root.name=`Cosmetic ${design.id} mascot ${i+1}`;rat.root.scale.setScalar(1.25);view.root.add(rat.root);view.rats.push(rat);}
  }
 }
 setScore(id:NestId,score:number){
  const v=this.nests.get(id)!;if(v.score===score)return;v.score=score;v.tier=visualTier(score);
  const d=NEST_DESIGNS.find(n=>n.id===id)!,g=v.labelCanvas.getContext('2d')!;g.clearRect(0,0,512,160);g.fillStyle='#101811ee';g.beginPath();g.roundRect(0,0,512,160,22);g.fill();g.fillStyle=d.color;g.font='bold 34px sans-serif';g.textAlign='center';g.fillText(d.id+'  /  NEST '+d.letter,256,48);g.fillStyle='#fff5df';g.font='bold 52px Georgia';g.fillText(score.toLocaleString('en-US')+' pts',256,113);v.labelMap.needsUpdate=true;
 }
 play(event:VisualEvent|null){if(!event){this.serial=0;for(const v of this.nests.values())v.event=null;return;}if(event.serial===this.serial)return;this.serial=event.serial;const v=this.nests.get(event.nest)!;v.event=event.kind;v.eventAt=this.time;}
 reveal(winner:NestId|null,serial:number){if(serial===this.revealSerial)return;this.revealSerial=serial;this.winner=winner;this.revealAt=this.time;}
 update(dt:number,reduced:boolean,level:number,camera:T.Camera){
  this.time+=clamp(dt,0,.1);
  for(const design of NEST_DESIGNS){const v=this.nests.get(design.id)!;v.growth=reduced?v.tier:T.MathUtils.damp(v.growth,v.tier,3,dt);
   v.layers.forEach((g,i)=>{const s=clamp(v.growth-i,0,1);g.visible=s>.001;g.scale.set(1,Math.max(.001,s),1);});
   if(!reduced&&level<3){const p=v.flag.geometry.attributes.position as T.BufferAttribute;for(let i=0;i<p.count;i++){const x=v.flagBase[i*3],y=v.flagBase[i*3+1],f=x/3.4;p.setXYZ(i,x,y+Math.sin(this.time*2-x*.8)*.06*f,Math.sin(x*2.4-this.time*2.8+y*.7)*.28*f);}p.needsUpdate=true;}
   const winner=this.winner===design.id;v.crown.visible=winner;v.crown.rotation.y=reduced?0:this.time*.55;v.crown.position.y=4.4+(reduced?0:Math.sin(this.time*2)*.12);
   const age=this.time-v.eventAt,effect=v.event!==null&&age<3.5;
   v.shield.visible=effect&&v.event==='shield';v.shield.material.opacity=reduced?.18:.12+Math.sin(this.time*4)*.035;
   v.snake.visible=effect&&v.event==='attack';v.snake.position.set(reduced?0:Math.sin(age*2)*2.5,.3,2.7);v.snake.rotation.y=reduced?0:Math.cos(age*2)*.3;
   v.food.visible=effect&&v.event==='feed';v.food.position.set(-1.3, reduced?.8:.45+Math.abs(Math.sin(age*3))*.8,2);
   const haloMat=v.halo.material as T.MeshBasicMaterial;haloMat.color.set(v.event==='attack'&&effect?'#f47b66':design.color);haloMat.opacity=winner?.45:effect?.28*(reduced?1:1-age/3.5):.06;
   v.halo.scale.setScalar(reduced?1:1+(effect?Math.sin(age*5)*.05:0));
   v.rats.forEach((rat,i)=>{const moving=!reduced;const a=(reduced?i*Math.PI:this.time*.22+i*Math.PI);rat.root.position.set(Math.cos(a)*1.65,.36,2.2+Math.sin(a)*.55);rat.root.rotation.y=-a+Math.PI/2;rat.root.updateMatrixWorld(true);rat.qualityLevel=level;const pos=rat.root.getWorldPosition(new T.Vector3());rat.update(dt,camera.position.distanceTo(pos),moving,.4,reduced,false,true,false,false,()=>v.root.position.y+.36);});
  }
  const age=this.time-this.revealAt;this.burst.visible=!!this.winner&&!reduced&&age<6.5;
  if(this.burst.visible){const origin=this.nests.get(this.winner!)!.root.position,p=this.burst.geometry.attributes.position as T.BufferAttribute,c=this.burst.geometry.attributes.color as T.BufferAttribute,count=level===0?this.budget:level===3?32:96;this.burst.geometry.setDrawRange(0,count);
   for(let i=0;i<count;i++){const group=i%3,t=age-group*.7,theta=noise(i+2)*Math.PI*2,u=noise(i+50)*2-1,r=Math.sqrt(1-u*u),speed=2+noise(i+130)*2.8,flight=clamp(t-.7,0,4);const launch=clamp(t/.7,0,1)*8;const centerX=origin.x+(group-1)*2.5,centerZ=origin.z+(group%2)*1.5;
    p.setXYZ(i,centerX+Math.cos(theta)*r*speed*flight,origin.y+3+launch+u*speed*flight-flight*flight*1.5,centerZ+Math.sin(theta)*r*speed*flight);
    const col=new T.Color(i%3===0?'#fff0b4':NEST_DESIGNS.find(n=>n.id===this.winner)!.color);col.multiplyScalar(t<0?0:clamp(1-flight/3.5,0,1));c.setXYZ(i,col.r,col.g,col.b);
   }p.needsUpdate=true;c.needsUpdate=true;
  }
 }
 anchor(id:NestId){return this.nests.get(id)!.root.position.clone();}
 diagnostics(){return {nests:[...this.nests].map(([id,v])=>({id,position:v.root.position.toArray(),score:v.score,tier:v.tier,mascots:v.rats.length,crown:v.crown.visible})),particles:this.burst.visible?this.burst.geometry.drawRange.count:0,winner:this.winner};}
 dispose(){for(const v of this.nests.values())for(const rat of v.rats)rat.dispose();const gs=new Set<T.BufferGeometry>(),ms=new Set<T.Material>();this.root.traverse(o=>{if(o instanceof T.Mesh||o instanceof T.Points){gs.add(o.geometry);(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>ms.add(m));}else if(o instanceof T.Sprite)ms.add(o.material);});gs.forEach(g=>g.dispose());ms.forEach(m=>m.dispose());this.textures.forEach(t=>t.dispose());this.root.removeFromParent();}
}