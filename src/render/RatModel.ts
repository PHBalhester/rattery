import {encounterPose} from '../sim/pairEncounter';
import {ratGround} from './ratGround';
import {physique} from '../sim/physique';
import {type BlenderRatAssets,type BlenderRatVisual} from './BlenderRat';
import {platformHeight,habitatRoutes,toyApproaches} from '../sim/habitatLayout';
import * as T from 'three';
import {playActivity} from '../sim/playActivity';


import {coatFor} from './ratIdentity';
import type { Rat } from '../types';
import { CONFIG } from '../config';
import { NEST_POS } from '../sim/colony';

// Render-only shared assets. No simulation RNG or state is modified.
export class RatAssets {
  birthRing=new T.RingGeometry(.8,.85,32);
  birthMaterial=new T.MeshBasicMaterial({color:0xe8c36a,transparent:true,opacity:.65,side:T.DoubleSide,depthWrite:false});
  private variants=new Map<string,T.BufferGeometry>();
  variant(id:string){
    const c=coatFor(id),key=c.name+c.key,cached=this.variants.get(key);if(cached)return cached;
    const g=this.body.clone(),p=g.getAttribute('position'),colors=g.getAttribute('color');
    const dorsal=new T.Color(c.color),belly=new T.Color(c.belly);
    const accent=new T.Color('accent' in c?c.accent:c.belly);
    for(let i=0;i<p.count;i++){
      const x=p.getX(i),y=p.getY(i),z=p.getZ(i),underside=1-T.MathUtils.smoothstep(y,.27,.42);
      const spots=Math.sin(x*13+c.key)*Math.cos(z*19+c.key*.7)+Math.sin(y*22+x*9);
      let pattern=c.pattern==='patches'?T.MathUtils.smoothstep(spots,.1,.65):c.pattern==='hooded'?1-T.MathUtils.smoothstep(x,-.04,.2):0;
      if(c.pattern==='dots'){
        const dx=((x+.7)*7+c.key*.17)%1-.5,dz=((z+.4)*9)%1-.5;
        pattern=1-T.MathUtils.smoothstep(Math.hypot(dx,dz),.19,.29);
      }
      if(c.pattern==='lightning'){
        const zig=.1*Math.abs((((x+.7)*7+c.key*.2)%2)-1)-.05;
        pattern=1-T.MathUtils.smoothstep(Math.abs(z-zig),.025,.06);
      }
      const color=dorsal.clone().lerp(accent,pattern*(1-underside)).lerp(belly,underside);
      colors.setXYZ(i,color.r,color.g,color.b);
    }
    this.variants.set(key,g);return g;
  }
  referenceBody:T.BufferGeometry;
  referenceHair:T.BufferGeometry;
  referenceFur=new T.MeshStandardMaterial({color:0xe6e2dd,roughness:.94});
  referenceSkin=new T.MeshStandardMaterial({color:0xd6a8ac,roughness:.73});
  referenceEyes=new T.MeshPhysicalMaterial({color:0x351111,roughness:.17,clearcoat:1});
  referenceHairMaterial=new T.LineBasicMaterial({color:0xf4efea,transparent:true,opacity:.38,depthWrite:false});
  sphere=new T.SphereGeometry(1,20,14);
  limb=new T.CylinderGeometry(.065,.045,1,8);
  body: T.BufferGeometry;
  tail:T.TubeGeometry;
  fur=new T.MeshStandardMaterial({vertexColors:true,roughness:.96});
  skin=new T.MeshStandardMaterial({color:0xb68b80,roughness:.8});
  innerEar=new T.MeshStandardMaterial({color:0xcd9e93,roughness:.86,side:T.DoubleSide});
  eyes=new T.MeshPhysicalMaterial({color:0x090b0b,roughness:.16,clearcoat:.8});
  coat=new T.MeshStandardMaterial({color:0x9b8d79,roughness:.97});
  whiskers=new T.LineBasicMaterial({color:0xc6b9a2,transparent:true,opacity:.55});
  whiskerGeometry: T.BufferGeometry;
  constructor(){
    const tailCurve=new T.CatmullRomCurve3([new T.Vector3(0,0,0),new T.Vector3(-.18,-.13,.025),new T.Vector3(-.43,-.19,.085),new T.Vector3(-.72,-.2,.17),new T.Vector3(-1.02,-.19,.2)]);
    this.tail=new T.TubeGeometry(tailCurve,40,.042,10,false);
    const tailPositions=this.tail.getAttribute('position');
    for(let i=0;i<tailPositions.count;i++){const f=Math.floor(i/11)/40,center=tailCurve.getPointAt(f);const p=new T.Vector3().fromBufferAttribute(tailPositions,i).sub(center).multiplyScalar(1-f*.88).add(center);tailPositions.setXYZ(i,p.x,p.y,p.z);}this.tail.computeVertexNormals();
    // Continuous torso and tapered muzzle. Cross-section variation avoids toy-like capsules.
    const rings=[[-.62,.02,.025,.32],[-.54,.19,.23,.32],[-.38,.29,.29,.35],[-.12,.27,.25,.37],[.12,.235,.22,.37],[.3,.21,.185,.39],[.44,.17,.15,.38],[.59,.105,.095,.32],[.73,.026,.035,.265]];
    const curveY=new T.CatmullRomCurve3(rings.map(r=>new T.Vector3(r[0],r[1],0)));
    const curveZ=new T.CatmullRomCurve3(rings.map(r=>new T.Vector3(r[0],r[2],r[3])));
    const positions:number[]=[],colors:number[]=[],indices:number[]=[];
    const dorsal=new T.Color(0x756b5d),belly=new T.Color(0xc8bba1);
    for(let i=0;i<=48;i++){const p=curveY.getPoint(i/48),q=curveZ.getPoint(i/48);for(let j=0;j<=24;j++){const angle=j/24*Math.PI*2;positions.push(p.x,q.z+Math.cos(angle)*Math.max(.005,p.y),Math.sin(angle)*Math.max(.005,q.y));const mix=T.MathUtils.smoothstep(-Math.cos(angle),-.25,.8);const c=dorsal.clone().lerp(belly,mix);const grain=.97+.035*Math.sin(i*37.7+j*23.3);c.multiplyScalar(grain);colors.push(c.r,c.g,c.b);if(i<48&&j<24){const a=i*25+j;indices.push(a,a+1,a+25,a+1,a+26,a+25);}}}
    const rear=positions.length/3;positions.push(-.62,.32,0,.73,.265,0);colors.push(dorsal.r,dorsal.g,dorsal.b,dorsal.r,dorsal.g,dorsal.b);
    for(let j=0;j<24;j++){indices.push(rear,j+1,j,rear+1,48*25+j,48*25+j+1);}
    this.body=new T.BufferGeometry();this.body.setAttribute('position',new T.Float32BufferAttribute(positions,3));this.body.setAttribute('color',new T.Float32BufferAttribute(colors,3));this.body.setIndex(indices);this.body.computeVertexNormals();
    this.referenceBody=this.body.clone();
    const rp=this.referenceBody.getAttribute('position');
    const anatomy=[[-.72,.015,.018,.37],[-.6,.21,.21,.4],[-.4,.31,.285,.41],[-.17,.3,.27,.39],[.06,.23,.22,.39],[.24,.21,.19,.45],[.4,.2,.17,.445],[.56,.12,.115,.355],[.74,.025,.032,.267]];
    const shape=new T.CatmullRomCurve3(anatomy.map(r=>new T.Vector3(r[0],r[1],r[2])));
    const center=new T.CatmullRomCurve3(anatomy.map(r=>new T.Vector3(r[0],r[3],0)));
    for(let i=0;i<=48;i++){
      const p=shape.getPoint(i/48),c=center.getPoint(i/48);
      for(let j=0;j<=24;j++){const angle=j/24*Math.PI*2;rp.setXYZ(i*25+j,p.x,c.y+Math.cos(angle)*p.y,Math.sin(angle)*p.z);}
    }
    rp.setXYZ(49*25,-.72,.37,0);rp.setXYZ(49*25+1,.74,.267,0);
    this.referenceBody.computeVertexNormals();
    const normal=this.referenceBody.getAttribute('normal'),hair:number[]=[];
    let seed=7351;const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
    const index=this.referenceBody.index!;
    for(let i=0;i<2200;i++){
      const triangle=Math.floor(rand()*index.count/3)*3;
      const ids=[index.getX(triangle),index.getX(triangle+1),index.getX(triangle+2)];
      const u=Math.sqrt(rand()),v=rand(),weights=[1-u,u*(1-v),u*v];
      const point=new T.Vector3(),n=new T.Vector3();
      ids.forEach((id,j)=>{point.addScaledVector(new T.Vector3().fromBufferAttribute(rp,id),weights[j]);n.addScaledVector(new T.Vector3().fromBufferAttribute(normal,id),weights[j]);});
      if(point.y<.25)continue;n.normalize();
      const tip=point.clone().addScaledVector(n,.004+rand()*.009);tip.x-=.01;
      hair.push(...point.toArray(),...tip.toArray());
    }
    this.referenceHair=new T.BufferGeometry();this.referenceHair.setAttribute('position',new T.Float32BufferAttribute(hair,3));
    const w:number[]=[];for(const side of [-1,1])for(let k=0;k<5;k++){w.push(.65,.275,side*.06,.69-k*.055,.28+(k-2)*.02,side*(.24+k*.026));}this.whiskerGeometry=new T.BufferGeometry();this.whiskerGeometry.setAttribute('position',new T.Float32BufferAttribute(w,3));
  }
  dispose(){for(const g of this.variants.values())g.dispose();this.variants.clear();[this.referenceBody,this.referenceHair,this.birthRing,this.sphere,this.limb,this.body,this.tail,this.whiskerGeometry].forEach(g=>g.dispose());[this.referenceFur,this.referenceSkin,this.referenceEyes,this.referenceHairMaterial,this.birthMaterial,this.fur,this.skin,this.innerEar,this.eyes,this.coat,this.whiskers].forEach(m=>m.dispose());}
}

type Leg={hip:T.Vector3;upper:T.Mesh;lower:T.Mesh;paw:T.Mesh;joint:T.Mesh;front:boolean;side:number};
const up=new T.Vector3(0,1,0);
function segment(mesh:T.Mesh,a:T.Vector3,b:T.Vector3,radius=1){const delta=b.clone().sub(a);mesh.position.copy(a).add(b).multiplyScalar(.5);mesh.scale.set(radius,delta.length(),radius);mesh.quaternion.setFromUnitVectors(up,delta.normalize());}

export class RatModel {
  root=new T.Group();
  private blender?:BlenderRatVisual;
  setRenderQuality(level:number){if(this.blender)this.blender.qualityLevel=Math.max(0,Math.min(3,Math.floor(level)));}
  private bodySize=1;
  private encounterStart=NaN;
  private encounterSeconds=0;
  attachBlender(assets:BlenderRatAssets){
    if(this.blender)return;
    this.blender=assets.create(this.root.userData.id);for(const child of [...this.root.children])if(child!==this.birthMarker)this.root.remove(child);this.root.add(this.blender.root);
  }
  private torso=new T.Group();
  private body:T.Mesh;
  private detail=new T.Group();
  private legs:Leg[]=[];
  private tail:T.Mesh;
  private eyes:T.Mesh[]=[];
  private ears:T.Group[]=[];
  private last=new T.Vector3();
  private target=new T.Vector3();
  private initialized=false;
  private phase=0;
  private speed=0;
  private moving=false;
  private desiredHeading=0;
  private seed=0;
  private birthAge=10;
  private birthMarker:T.Mesh;

  constructor(private assets:RatAssets,id:string,private reference=false){
    this.bodySize=physique(id);
    this.birthMarker=new T.Mesh(assets.birthRing,assets.birthMaterial);this.birthMarker.rotation.x=-Math.PI/2;this.birthMarker.position.y=.015;this.root.add(this.birthMarker);
    this.root.userData.id=id;for(const c of id)this.seed=(this.seed*31+c.charCodeAt(0))%997;
    this.phase=this.seed*.17;this.root.add(this.torso);this.torso.add(this.detail);
    this.body=new T.Mesh(reference?assets.referenceBody:assets.variant(id),reference?assets.referenceFur:assets.fur);this.body.castShadow=true;this.body.receiveShadow=true;this.torso.add(this.body);
    if(reference)this.torso.add(new T.LineSegments(assets.referenceHair,assets.referenceHairMaterial));
    const mesh=(parent:T.Group,mat:T.Material,p:number[],s:number[])=>{const m=new T.Mesh(assets.sphere,reference?(mat===assets.eyes?assets.referenceEyes:mat===assets.coat?assets.referenceFur:mat===assets.skin||mat===assets.innerEar?assets.referenceSkin:mat):mat);m.position.set(p[0],p[1],p[2]);m.scale.set(s[0],s[1],s[2]);parent.add(m);return m;};
    if(reference)for(const side of [-1,1]){
      mesh(this.torso,assets.coat,[-.36,.26,side*.11],[.21,.205,.145]);
      mesh(this.torso,assets.coat,[.22,.285,side*.11],[.10,.13,.09]);
    }
    mesh(this.detail,assets.skin,[.742,.266,0],[.038,.025,.032]);
    for(const side of [-1,1]){
      const ear=new T.Group();ear.position.set(.29,.61,side*.145);ear.rotation.x=side*.38;ear.rotation.z=-.2;this.detail.add(ear);this.ears.push(ear);if(reference){ear.scale.set(1.15,1.3,.7);ear.position.y=.66;}
      mesh(ear,assets.coat,[0,0,0],[.095,.12,.021]);mesh(ear,assets.innerEar,[0,.005,side*.018],[.073,.094,.01]);
      this.eyes.push(mesh(this.detail,assets.eyes,[.477,.428,side*.155],[.036,.036,.025]));
      for(const front of [true,false]){const upper=new T.Mesh(assets.limb,assets.coat),lower=new T.Mesh(assets.limb,assets.skin),paw=mesh(this.root,assets.skin,[0,0,0],[.105,.026,.042]),joint=mesh(this.root,assets.coat,[0,0,0],front?[.035,.035,.035]:[.05,.05,.05]);this.root.add(upper,lower);
        if(reference){
          const toes=new T.InstancedMesh(assets.sphere,assets.referenceSkin,4),matrix=new T.Matrix4(),q=new T.Quaternion();
          for(let toe=0;toe<4;toe++){matrix.compose(new T.Vector3(.65,0,(toe-1.5)*.45),q,new T.Vector3(.6,.55,.18));toes.setMatrixAt(toe,matrix);}paw.add(toes);
          upper.material=assets.referenceFur;lower.material=assets.referenceSkin;
        }
        this.legs.push({hip:new T.Vector3(front?.25:-.37,.29,side*.18),upper,lower,paw,joint,front,side});}
    }
    this.detail.add(new T.LineSegments(assets.whiskerGeometry,assets.whiskers));
    this.tail=new T.Mesh(assets.tail,reference?assets.referenceSkin:assets.skin);this.tail.position.set(-.55,.235,0);this.root.add(this.tail);
  }
  sync(r:Rat,day:number,dt:number,time:number,reduced:boolean,discontinuity:boolean,camera:T.Camera){
    const nestDistance=Math.hypot(r.x-NEST_POS.x,r.y-NEST_POS.y)/30;
    let ground=-.10+.25*(1-T.MathUtils.smoothstep(nestDistance,2.55,3));
    for(const route of habitatRoutes){const distance=Math.hypot(r.x-route[81].x,r.y-route[81].z)/30;ground=Math.max(ground,-.1+.21*(1-T.MathUtils.smoothstep(distance,2.1,2.4)));}
    ground=Math.max(ground,-.1+platformHeight(r.x,r.y)/30);
    this.target.set((r.x-CONFIG.colony.burrowWidth/2)/30,ground,(r.y-CONFIG.colony.burrowHeight/2)/30);
    const snap=!this.initialized||discontinuity||reduced||this.root.position.distanceTo(this.target)>1;
    this.last.copy(this.root.position);
    if(snap)this.root.position.copy(this.target);else this.root.position.lerp(this.target,1-Math.exp(-22*dt));
    // Resolve contact height at the displayed position, avoiding floating during interpolation.
    const shownX=this.root.position.x*30+CONFIG.colony.burrowWidth/2,shownY=this.root.position.z*30+CONFIG.colony.burrowHeight/2;
    let contact=-.10+.25*(1-T.MathUtils.smoothstep(Math.hypot(shownX-NEST_POS.x,shownY-NEST_POS.y)/30,2.55,3));
    for(const route of habitatRoutes){const d=Math.hypot(shownX-route[81].x,shownY-route[81].z)/30;contact=Math.max(contact,-.1+.21*(1-T.MathUtils.smoothstep(d,2.1,2.4)),d<.65?.11+.035*(1-T.MathUtils.smoothstep(d,.55,.65)):-.1);}
    this.root.position.y=Math.max(contact,-.1+platformHeight(shownX,shownY)/30);
    const dx=this.root.position.x-this.last.x,dz=this.root.position.z-this.last.z;
    const distance=this.initialized&&!snap?Math.hypot(dx,dz):0;
    const actualSpeed=dt>0?distance/dt:0;
    this.speed=T.MathUtils.lerp(this.speed,actualSpeed,1-Math.exp(-12*dt));
    if(discontinuity)this.speed=0;
    const velocity=Math.hypot(r.vx,r.vy);
    // Follow displayed travel, including social movement that does not update vx/vy.
    const traveling=!snap&&distance>0.00001;
    if(traveling||velocity>(this.moving?.15:.3)){this.moving=true;this.desiredHeading=velocity>.2?-Math.atan2(r.vy,r.vx):-Math.atan2(dz,dx);}else this.moving=false;
    if(r.socialAction?.encounter)this.desiredHeading=-r.socialAction.encounter.heading;
    // Finish the last gentle turn even when translation has already stopped.
    const headingDelta=Math.atan2(Math.sin(this.desiredHeading-this.root.rotation.y),Math.cos(this.desiredHeading-this.root.rotation.y));
    this.root.rotation.y+=snap?headingDelta:T.MathUtils.clamp(headingDelta*(1-Math.exp(-8*dt)),-2.4*dt,2.4*dt);
    if(!this.initialized&&r.bornAt>=0&&day-r.bornAt<.1)this.birthAge=0;
    this.birthAge+=dt;this.birthMarker.visible=this.birthAge<3&&!reduced;this.birthMarker.scale.setScalar(1+this.birthAge*.4);
    this.initialized=true;
    const age=Math.max(0,day-r.bornAt),mature=r.sex==='F'?CONFIG.bio.femaleMatureDay:CONFIG.bio.maleMatureDay;
    const size=age<14?T.MathUtils.lerp(.22,.48,age/14):age<21?T.MathUtils.lerp(.48,.65,(age-14)/7):T.MathUtils.lerp(.65,1,Math.min(1,(age-21)/(mature-21)));
    this.root.scale.setScalar(size*this.bodySize);
    this.body.material=this.reference?this.assets.referenceFur:r.stage==='neonate'?this.assets.skin:this.assets.fur;
    // Facial features are part of the silhouette, not optional distance detail.
    // Keep the same anatomy at every zoom, including all leg segments.
    void camera;
    this.detail.visible=true;
    const running=playActivity.get(r.id)?.kind==='wheel',digging=playActivity.get(r.id)?.kind==='digging';
    const wheel=running?toyApproaches.find(a=>a.toy===playActivity.get(r.id)?.toy):undefined;
    const wheelX=wheel?(wheel.contact.x-CONFIG.colony.burrowWidth/2)/30:0;
    if(wheel)this.root.position.set(wheelX,.035,(wheel.contact.z-CONFIG.colony.burrowHeight/2)/30);
    const wheelGround=(x:number)=>1.25-Math.sqrt(Math.max(.5,1.165**2-(x-wheelX)**2));
    const activity=reduced?0:running||digging?1:Math.min(1,this.speed/.35);
    if(digging&&!reduced)this.phase+=dt*10;
    if(running&&!reduced){this.phase+=dt*14;this.root.rotation.y=0;}
    if(!reduced)this.phase+=Math.min(distance/size/.75*Math.PI*2,dt*18);
    const stride=.15*activity,lift=.095*activity;
    // Diagonal pairs alternate. Phase advances from rendered travel, not a free-running clock.
    if(!this.blender)for(const leg of this.legs){const phase=this.phase+(leg.front===(leg.side>0)?0:Math.PI);const foot=new T.Vector3(leg.hip.x+Math.cos(phase)*stride,.025+Math.max(0,Math.sin(phase))*lift,leg.side*.205);const knee=new T.Vector3(leg.hip.x+(leg.front?-.06:.09),.14+Math.max(0,Math.sin(phase))*.025,leg.side*.23);segment(leg.upper,leg.hip,knee,leg.front?.6:1.15);segment(leg.lower,knee,foot,.45);leg.joint.position.copy(knee);leg.paw.position.copy(foot);leg.paw.position.x+=.035;}
    const idle=!reduced?.004*Math.sin(time*2.6+this.seed):0;
    this.torso.position.y=idle+Math.abs(Math.sin(this.phase*2))*.015*activity;
    this.torso.rotation.x=Math.sin(this.phase)*.025*activity;
    const play=playActivity.get(r.id);
    this.torso.rotation.z=play&&!reduced?(digging?-.14:-.035)-.035*Math.sin((day-play.since)*160):0;
    const social=r.socialAction&&r.socialAction.until>day?r.socialAction:null;
    for(let i=0;i<this.ears.length;i++)this.ears[i].rotation.x=(i===0?-1:1)*.38;
    if(social&&!reduced){const pulse=Math.sin(time*(social.kind==='fight'?18:6)+this.seed);
      this.torso.rotation.z=social.kind==='fight'?pulse*.16:social.kind==='mating'?pulse*.05:-.07+ pulse*.025;
      this.torso.position.y+=social.kind==='courtship'?Math.abs(pulse)*.09:social.kind==='fight'?Math.abs(pulse)*.06:0;
      this.ears.forEach(e=>e.rotation.x=social.kind==='fight'?.7:.3);
    }
    this.body.scale.z=r.pregnant?1.25:1;
    for(const e of this.eyes){e.visible=day-r.bornAt>=CONFIG.bio.eyesOpenDay;e.scale.y=!reduced&&Math.sin(time*.85+this.seed)>.998?.007:.036;}
    for(let i=0;i<this.ears.length;i++)this.ears[i].rotation.z=-.2+(!reduced?.035*Math.sin(time*1.4+this.seed+i):0);
    this.tail.rotation.y=reduced?0:Math.sin(this.phase*.55)*.08*activity;
    for(const leg of this.legs){leg.joint.visible=leg.lower.visible=true;}
    if(this.blender){
      const encounter=social?.encounter;
      if(encounter){
        const seconds=(day-encounter.started)*CONFIG.time.realMsPerSimDay/1000;
        if(this.encounterStart!==encounter.started||discontinuity||reduced||Math.abs(seconds-this.encounterSeconds)>.3)this.encounterSeconds=seconds;
        else this.encounterSeconds=Math.min(seconds+CONFIG.time.tickMs/1000,Math.max(seconds,this.encounterSeconds+dt));
        this.encounterStart=encounter.started;
      }else this.encounterStart=NaN;
      const pose=encounter?encounterPose(this.encounterSeconds):undefined;

      for(const child of this.root.children)if(child!==this.birthMarker&&child!==this.blender.root)child.visible=false;
      this.blender.root.position.set(0,0,0);this.blender.root.rotation.set(0,0,0);
      if(pose&&r.sex==='M'){this.blender.root.position.y=pose.y+pose.lift*.7*Math.max(0,encounter!.scale/(size*this.bodySize)-1);this.blender.root.rotation.z=pose.pitch;}
      this.blender.update(dt,camera.position.distanceTo(this.root.position)/Math.max(.25,size),activity>.08,Math.max(this.speed,running||digging?.7:0),reduced,discontinuity,age>=CONFIG.bio.eyesOpenDay,!!r.pregnant,!!social,wheel?wheelGround:ratGround,running||digging,running,true,pose?{blend:r.sex==='M'?pose.lift:1,frontHeight:r.sex==='M'?pose.frontHeight*encounter!.scale:0,rhythm:reduced?0:r.sex==='M'?pose.rhythm:0}:undefined,r.wellbeing?.isolationDistress??0);
    }
  }
  dispose(){this.blender?.dispose();this.root.removeFromParent();this.root.clear();}
}
