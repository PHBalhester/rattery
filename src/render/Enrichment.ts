import * as T from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {habitatRoutes,obstacles,toyApproaches,wheelToys,platformPaths,platformHeight,diggingToy} from '../sim/habitatLayout';
export {obstacles} from '../sim/habitatLayout';
import {playActivity} from '../sim/playActivity';
import {CONFIG} from '../config';
import type {World} from '../types';
const W=CONFIG.colony.burrowWidth,H=CONFIG.colony.burrowHeight;
const point=(p:T.Vector3)=>new T.Vector3((p.x-W/2)/30,0,(p.z-H/2)/30);
export function addEnrichment(scene:T.Scene,staticScene:T.Group|T.Scene=scene){
 const rounded=(w:number,h:number,d:number)=>new RoundedBoxGeometry(w,h,d,2,Math.min(.04,w/5,h/5,d/5));
 const wood=new T.MeshStandardMaterial({color:0x9f7950,roughness:.9});
 const rope=new T.MeshStandardMaterial({color:0xcab994,roughness:1});
 const colors=[0x739f96,0xc4975e,0xb4796c,0x8b87ad,0x9ba46a];
 const balls=new Map<number,{mesh:T.Mesh;home:T.Vector3}>();
 const dirt=new T.MeshStandardMaterial({color:0x59402b,roughness:1});
 for(const platform of platformPaths){const corner=point(platform.points[1]);add(new T.CylinderGeometry(14/30,14/30,.035,20),wood,staticScene,corner.clone().setY(.5-.0175));for(let k=1;k<platform.points.length;k++){const a=platform.points[k-1],b=platform.points[k],side=b.clone().sub(a).normalize();const nx=-side.z*14,nz=side.x*14,vertices:number[]=[],indices:number[]=[];
  for(let i=0;i<=32;i++){const p=a.clone().lerp(b,i/32),h=-.1+platformHeight(p.x,p.z)/30;for(const sign of [-1,1])vertices.push((p.x+nx*sign-W/2)/30,h,(p.z+nz*sign-H/2)/30);}
  for(let i=0;i<32;i++){const j=i*2;indices.push(j,j+2,j+1,j+1,j+2,j+3);}const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(vertices,3));geo.setIndex(indices);geo.computeVertexNormals();const mat=wood.clone();mat.side=T.DoubleSide;const deck=new T.Mesh(geo,mat);deck.castShadow=deck.receiveShadow=true;staticScene.add(deck);
 }}
 const dig=toyApproaches.find(a=>a.toy===diggingToy);if(dig){const c=point(dig.contact);add(new T.CylinderGeometry(.6,.65,.08,24),dirt,staticScene,c.clone().setY(-.08));for(let i=0;i<16;i++){const a=i*2.4;add(new T.SphereGeometry(.035,6,4),rope,staticScene,c.clone().add(new T.Vector3(Math.cos(a)*.5,-.025,Math.sin(a)*.5)));}}
 const wheels=new Map<number,T.Group>();
 const moving:{group:T.Group;position:T.Vector3;phase:number}[]=[];
 function add(geo:T.BufferGeometry,mat:T.Material,parent:T.Object3D,pos:T.Vector3){const m=new T.Mesh(geo,mat);m.position.copy(pos);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;};
 habitatRoutes.forEach((route,index)=>{
  const c=point(route[65]),direction=route[66].clone().sub(route[64]).normalize();
  const arch=new T.Group();arch.position.copy(c);arch.rotation.y=Math.atan2(direction.x,direction.z);scene.add(arch);
  const points=Array.from({length:25},(_,i)=>{const angle=i/24*Math.PI;return new T.Vector3(Math.cos(angle)*1.12,.62+Math.sin(angle)*.98,0);});
  add(new T.TubeGeometry(new T.CatmullRomCurve3(points),32,.065,8,false),wood,arch,new T.Vector3());
  const beadGroup=new T.Group();beadGroup.position.y=1.2;arch.add(beadGroup);
  const paint=new T.MeshStandardMaterial({color:colors[index],roughness:.72});
  for(let i=-1;i<=1;i++)add(new T.SphereGeometry(.10,12,8),i===0?paint:rope,beadGroup,new T.Vector3(i*.23,0,0));
  moving.push({group:beadGroup,position:c.clone(),phase:index});
  // A low woven foraging mat gives the chamber pause a visible destination.
  const end=point(route[81]);const mat=add(new T.CylinderGeometry(.6,.6,.025,32),rope,staticScene,end.clone().setY(.12));
  mat.receiveShadow=true;
  // Visible resource stations flank the open approach to each chamber.
  const water=new T.MeshStandardMaterial({color:0x649fb8,roughness:.25});
  add(new T.CylinderGeometry(.3,.35,.16,20),wood,staticScene,end.clone().add(new T.Vector3(.5,.12,.48)));
  add(new T.CylinderGeometry(.26,.26,.02,20),water,staticScene,end.clone().add(new T.Vector3(.5,.21,.48)));
  // Two low side walls and a roof leave both ends of the refuge open.
  for(const side of [-1,1])add(rounded(.12,.8,1.4),wood,staticScene,end.clone().add(new T.Vector3(side*.9,.45,0)));
  add(rounded(1.92,.12,1.4),wood,staticScene,end.clone().add(new T.Vector3(0,.91,0)));

  for(let i=0;i<9;i++){const a=i*2.4,r=.36*Math.sqrt(i/9);add(new T.SphereGeometry(.045,8,6),wood,staticScene,end.clone().add(new T.Vector3(Math.cos(a)*r,.17,Math.sin(a)*r)));}
 });
 for(const approach of toyApproaches.filter(a=>wheelToys.has(a.toy))){
  const c=point(approach.contact),frame=new T.Group();frame.position.copy(c);scene.add(frame);
  const rotor=new T.Group();rotor.position.y=1.25;frame.add(rotor);wheels.set(approach.toy,rotor);
  for(const z of [-.42,.42]){add(new T.TorusGeometry(1.2,.08,8,40),wood,rotor,new T.Vector3(0,0,z));}
  for(let i=0;i<24;i++){const a=i/24*Math.PI*2;const slat=add(rounded(.29,.07,.84),rope,rotor,new T.Vector3(Math.cos(a)*1.2,Math.sin(a)*1.2,0));slat.rotation.z=a+Math.PI/2;}
  add(rounded(2.8,.1,1.2),wood,frame,new T.Vector3(0,.01,0));
 }
 for(const {p,index} of obstacles){const c=point(p),paint=new T.MeshStandardMaterial({color:colors[index],roughness:.8});
  // Rounded chew drums and blocks are obstacles alongside the outdoor circuit.
  if(index%2===0){const ball=add(new T.SphereGeometry(.55,20,14),paint,scene,c.clone().setY(.4));balls.set(index,{mesh:ball,home:ball.position.clone()});add(new T.TorusGeometry(.55,.035,8,32),rope,ball,new T.Vector3());}
  else {const block=add(rounded(.95,.65,.95),wood,scene,c.clone().setY(.175));block.rotation.y=.3;add(new T.CylinderGeometry(.22,.22,.04,20),paint,block,new T.Vector3(0,.35,0));}
 }
 return {update(world:World,dt:number,reduced:boolean){
 for(const [id,rotor] of wheels){const active=[...playActivity.values()].some(a=>a.toy===id&&a.kind==='wheel');if(active&&!reduced)rotor.rotation.z=(world.simDay*120)%(Math.PI*2);}
 for(const [id,ball] of balls){const actor=[...playActivity.entries()].find(([ratId,a])=>a.toy===id&&a.kind==='ball'&&world.rats[ratId]?.deadAt===null);ball.mesh.position.copy(ball.home);ball.mesh.rotation.z=0;if(actor&&!reduced){const r=world.rats[actor[0]],phase=(world.simDay-actor[1].since)*160,away=ball.home.clone().sub(new T.Vector3((r.x-W/2)/30,ball.home.y,(r.y-H/2)/30)).normalize();const push=.07*(1-Math.cos(phase));ball.mesh.position.addScaledVector(away,push);ball.mesh.rotation.z=push/.55;}}
for(const toy of moving){let active=false;for(const r of Object.values(world.rats)){if(r.deadAt===null&&Math.hypot((r.x-W/2)/30-toy.position.x,(r.y-H/2)/30-toy.position.z)<1.2&&Math.hypot(r.vx,r.vy)>.2){active=true;break;}}
  // Decorative response to a passing rat, not a rigid-body physics simulation.
  
  const target=active&&!reduced?Math.sin(world.simDay*160+toy.phase)*.18:0;toy.group.rotation.z=T.MathUtils.lerp(toy.group.rotation.z,target,1-Math.exp(-8*dt));
 }}};
}
