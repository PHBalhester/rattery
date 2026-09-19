import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {SNAKE_DEN} from '../sim/snake';
import {CONFIG} from '../config';
import type {World} from '../types';
export class SnakeDen{
 scales:T.InstancedMesh;scalePose=new T.Object3D();model:T.Group|null=null;jaw:T.Object3D|null=null;body:T.Mesh;skull:T.Mesh;root=new T.Group();head=new T.Group();segments:T.Mesh[]=[];eyes:T.Mesh[]=[];
 constructor(scene:T.Scene){
  this.root.name='Snake den';scene.add(this.root);
  this.root.position.set((SNAKE_DEN.x-CONFIG.colony.burrowWidth/2)/30,0,(SNAKE_DEN.y-CONFIG.colony.burrowHeight/2)/30);
  const earth=new T.MeshStandardMaterial({color:0x49382b,roughness:1}),skin=new T.MeshStandardMaterial({color:0x414634,roughness:.72});
  const rim=new T.Mesh(new T.TorusGeometry(.73,.23,8,24),earth);rim.rotation.x=-Math.PI/2;rim.position.y=.02;this.root.add(rim);
  const hole=new T.Mesh(new T.CircleGeometry(.73,32),new T.MeshBasicMaterial({color:0x020302,side:T.DoubleSide}));hole.rotation.x=-Math.PI/2;hole.position.y=.015;this.root.add(hole);
  const tube=new T.CylinderGeometry(1,1,1,16,64,true);tube.rotateX(Math.PI/2);const indices:number[]=[];for(let i=0;i<64;i++)for(let j=0;j<16;j++){const a=i*17+j;indices.push(a,a+1,a+17,a+1,a+18,a+17);}tube.setIndex(indices);skin.clippingPlanes=[new T.Plane(new T.Vector3(0,1,0),-.025)];this.body=new T.Mesh(tube,skin);this.body.visible=false;this.body.castShadow=true;this.root.add(this.body);
  const scaleGeometry=new T.SphereGeometry(1,8,6);
  const scaleMaterial=new T.MeshStandardMaterial({color:new T.Color().setRGB(.23,.28,.12),roughness:.57,clippingPlanes:[new T.Plane(new T.Vector3(0,1,0),-.025)]});
  this.scales=new T.InstancedMesh(scaleGeometry,scaleMaterial,32*10);this.scales.instanceMatrix.setUsage(T.DynamicDrawUsage);this.scales.frustumCulled=false;this.scales.visible=false;this.scales.castShadow=true;this.root.add(this.scales);
  const skull=new T.Mesh(new T.SphereGeometry(1,16,10),skin);skull.scale.set(.34,.19,.46);this.skull=skull;this.head.add(skull);
  for(const sign of [-1,1]){const eye=new T.Mesh(new T.SphereGeometry(.048,8,6),new T.MeshBasicMaterial({color:0xd5b85d}));eye.position.set(sign*.24,.11,.21);this.head.add(eye);this.eyes.push(eye);const pupil=new T.Mesh(new T.SphereGeometry(.027,6,4),new T.MeshBasicMaterial({color:0x050500}));pupil.scale.x=.25;pupil.position.set(sign*.25,.12,.25);this.head.add(pupil);}
  this.root.add(this.head);
  new GLTFLoader().load('/models/snake.glb',g=>{
   this.model=g.scene;this.jaw=g.scene.getObjectByName('SnakeJaw')??null;
   g.scene.traverse(o=>{if(o instanceof T.Mesh){o.castShadow=true;for(const mat of(Array.isArray(o.material)?o.material:[o.material]))mat.clippingPlanes=[new T.Plane(new T.Vector3(0,1,0),-.025)];}});
   this.head.add(g.scene);
  });
 }
 update(w:World,models:Map<string,{root:T.Group}>,day:number,reduced:boolean){
  const c=w.snake?.capture;
  this.head.visible=true;
  this.skull.visible=!!c&&!this.model;if(this.model)this.model.visible=!!c;for(const eye of this.eyes)eye.visible=!c||!this.model;this.body.visible=!!c;this.scales.visible=!!c;
  if(!c){this.head.position.set(0,.015,0);this.head.rotation.set(0,0,0);this.segments.forEach(m=>m.visible=false);return;}
  const t=T.MathUtils.clamp((day-c.started)/.1,0,1),reach=t<.24?t/.24:Math.max(0,1-(t-.24)/.76);
  const dx=(c.x-SNAKE_DEN.x)/30,dz=(c.y-SNAKE_DEN.y)/30;
  const distance=Math.hypot(dx,dz)*reach;
  const height=(r:number)=>r<.48?-.32+.84*T.MathUtils.smoothstep(r,0,.48):.52;
  this.head.position.set(dx*reach,height(distance),dz*reach);
  if(this.jaw)this.jaw.rotation.x=t<.24?.65*Math.sin(Math.PI*t/.48):.18;this.head.rotation.y=Math.atan2(dx,dz);
  const vertices=this.body.geometry.getAttribute('position'),length=Math.hypot(dx,dz)*reach,heading=Math.atan2(dx,dz);
  for(let ring=0;ring<=64;ring++){
   const f=ring/64,z=f*length,radius=.17*(.65+.35*f),y=height(z);
   const slope=(height(z+.002)-height(Math.max(0,z-.002)))/.004,inv=1/Math.sqrt(1+slope*slope);
   for(let j=0;j<=16;j++){const angle=j/16*Math.PI*2,index=ring*17+j;vertices.setXYZ(index,Math.cos(angle)*radius,y+Math.sin(angle)*radius*inv,z-Math.sin(angle)*radius*slope*inv);}
  }
  vertices.needsUpdate=true;this.body.geometry.computeVertexNormals();this.body.geometry.computeBoundingSphere();this.body.rotation.y=heading;
  // Offset rows overlap like the plates on the Blender head. One draw call.
  this.scales.rotation.y=heading;
  let scaleIndex=0;
  const forward=new T.Vector3(),normal=new T.Vector3(),across=new T.Vector3(),basis=new T.Matrix4();
  for(let row=0;row<32;row++){
   const f=(row+.5)/32,z=f*length,radius=.17*(.65+.35*f),y=height(z);
   const slope=(height(z+.002)-height(Math.max(0,z-.002)))/.004;
   forward.set(0,slope,1).normalize();
   for(let col=0;col<10;col++){
    const angle=(col+(row%2)*.5)/10*Math.PI*2;
    normal.set(Math.cos(angle),Math.sin(angle)/Math.sqrt(1+slope*slope),-Math.sin(angle)*slope/Math.sqrt(1+slope*slope));
    across.crossVectors(normal,forward).normalize();basis.makeBasis(across,normal,forward);
    this.scalePose.position.set(normal.x*(radius+.007),y+normal.y*(radius+.007),z+normal.z*(radius+.007));
    this.scalePose.quaternion.setFromRotationMatrix(basis);
    this.scalePose.scale.set(.057,.012,Math.max(.018,length/32*.69));
    this.scalePose.updateMatrix();this.scales.setMatrixAt(scaleIndex++,this.scalePose.matrix);
   }
  }
  this.scales.instanceMatrix.needsUpdate=true;
  const rat=models.get(c.ratId)?.root;
  if(rat&&t>=.24){
   const unit=new T.Vector3(dx,0,dz).normalize();
   // Rats face local +X. Roll around that axis, then place crosswise to the bite.
   const yaw=new T.Quaternion().setFromAxisAngle(new T.Vector3(0,1,0),heading);
   const roll=new T.Quaternion().setFromAxisAngle(new T.Vector3(1,0,0),Math.PI/2);
   rat.quaternion.copy(yaw).multiply(roll);
   const centre=new T.Vector3(0,.38*rat.scale.y,0).applyQuaternion(rat.quaternion);
   const grip=.52+.31*rat.scale.z;
   rat.position.copy(this.root.position).add(this.head.position).addScaledVector(unit,grip).sub(centre);
   rat.position.y-=.06;
   rat.visible=distance>.25;
  }
 }
}
