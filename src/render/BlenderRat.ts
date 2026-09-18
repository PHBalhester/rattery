import {qualityProfiles} from './AdaptiveQuality';
import {TailCollision} from './TailCollision';
import {NaturalMotion} from './NaturalMotion';
import {StudyBodyMotion} from './StudyBodyMotion';

import {StudyFootMotor,type Ground} from './StudyFootMotor';
import * as T from 'three';
import {GLTFLoader,type GLTF} from 'three/addons/loaders/GLTFLoader.js';
import {clone} from 'three/addons/utils/SkeletonUtils.js';
import {identity,coatFor} from './ratIdentity';

function disposeScene(scene:T.Object3D){
 const geometries=new Set<T.BufferGeometry>(),materials=new Set<T.Material>(),skeletons=new Set<T.Skeleton>();
 scene.traverse(o=>{if(o instanceof T.Mesh){geometries.add(o.geometry);(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>materials.add(m));}if(o instanceof T.SkinnedMesh)skeletons.add(o.skeleton);});
 geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());skeletons.forEach(s=>s.dispose());
}
export class BlenderRatAssets{
 private levels:Map<string,T.BufferGeometry>[]=[];
 private constructor(private sources:GLTF[]){
  const signatures=new Map<string,string>();
  this.levels=sources.map((g,level)=>{const map=new Map<string,T.BufferGeometry>();g.scene.traverse(o=>{
   if(o instanceof T.SkinnedMesh){const signature=o.skeleton.bones.map(b=>b.name).join('|');
    if(level===0)signatures.set(o.name,signature);else if(signatures.get(o.name)!==signature)throw Error('Incompatible rat LOD skeleton');
    map.set(o.name,o.geometry);
   }
  });if(level&&map.size!==signatures.size)throw Error('Missing rat anatomy in LOD');return map;});
 }
 static async load(){
  const loader=new GLTFLoader();const results=await Promise.allSettled(['rat-gait-study','rat-gait-medium','rat-gait-far'].map(n=>loader.loadAsync(`/models/${n}.glb`)));
  const sources=results.flatMap(r=>r.status==='fulfilled'?[r.value]:[]);
  if(sources.length!==3){sources.forEach(g=>disposeScene(g.scene));throw Error('Could not load rat assets');}
  try{return new BlenderRatAssets(sources);}catch(e){sources.forEach(g=>disposeScene(g.scene));throw e;}
 }
 create(id:string){return new BlenderRatVisual(this.sources[0],this.levels,id);}
 dispose(){this.sources.forEach(g=>disposeScene(g.scene));}
}
export class BlenderRatVisual{
 readonly root=new T.Group();
 private model:T.Object3D;
 private tailCollision:TailCollision;
 private motor:StudyFootMotor;
 private bodyMotion:StudyBodyMotion;
 private naturalMotion:NaturalMotion;

 private restPositions=new Map<string,T.Vector3>();
 private rest=new Map<string,T.Quaternion>();

 qualityLevel=0;
 private lod=-1;private elapsed=0;private phase=0;private bones=new Map<string,T.Bone>();
 private meshes:T.SkinnedMesh[]=[];
 private materials:T.Material[]=[];
 constructor(gltf:GLTF,private levels:Map<string,T.BufferGeometry>[],id:string){
  this.model=clone(gltf.scene);this.model.scale.setScalar(.8);this.root.add(this.model);this.root.userData.blenderRat=true;

  const coat=coatFor(id);this.phase=identity(id)/4294967295*Math.PI*2;
  this.model.traverse(o=>{if(o instanceof T.Bone){this.bones.set(o.name,o);this.rest.set(o.name,o.quaternion.clone());this.restPositions.set(o.name,o.position.clone());}});

  this.tailCollision=new TailCollision(this.bones);
  this.motor=new StudyFootMotor(this.model,this.bones);
  this.bodyMotion=new StudyBodyMotion(this.bones);
  this.naturalMotion=new NaturalMotion(this.model,this.bones,this.phase);
  this.model.position.y=-.02;
  this.model.traverse(o=>{
   if(!(o instanceof T.SkinnedMesh))return;this.meshes.push(o);
   o.castShadow=o.name!=='Fine_ivory_fibres';o.receiveShadow=o.castShadow;
   // Deformed bounds must not be culled using the static rest pose.
   o.frustumCulled=false;
   if(o.name==='Ruby_black_eyes'){
    o.geometry.computeBoundingBox();const centerY=o.geometry.boundingBox!.getCenter(new T.Vector3()).y;
    const material=(o.material as T.MeshStandardMaterial).clone();
    material.onBeforeCompile=shader=>{shader.uniforms.ratBlink=this.naturalMotion.blink;shader.uniforms.eyeCenterY={value:centerY};shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nuniform float ratBlink;uniform float eyeCenterY;').replace('#include <begin_vertex>','#include <begin_vertex>\ntransformed.y=mix(transformed.y,eyeCenterY,ratBlink*.96);');};
    material.customProgramCacheKey=()=> 'rat-blink-v1';o.material=material;this.materials.push(material);
   }
   if(o.name==='Ear_inner_pink'||o.name==='Warm_pink_skin'){
    const material=(o.material as T.MeshStandardMaterial).clone();
    material.onBeforeCompile=shader=>{shader.uniforms.ratWithdrawal=this.naturalMotion.withdrawal;shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nuniform float ratWithdrawal;').replace('#include <begin_vertex>','#include <begin_vertex>\nfloat fold=smoothstep(.716,1.02,position.y)*ratWithdrawal; transformed.x-=.12*fold; transformed.y-=.09*fold;');};
    material.customProgramCacheKey=()=> 'rat-withdrawal-ears-v1';o.material=material;this.materials.push(material);
   }
   if(id!=='F1'&&(o.name==='Ivory_coat'||o.name==='Fine_ivory_fibres')){
    const material=(o.material as T.MeshStandardMaterial).clone();material.color.set('#ffffff');
    material.onBeforeCompile=shader=>{
     shader.uniforms.ratDorsal={value:new T.Color(coat.color)};shader.uniforms.ratBelly={value:new T.Color(coat.belly)};
     shader.uniforms.ratAccent={value:new T.Color('accent' in coat?coat.accent:coat.belly)};
     shader.uniforms.ratPatternPhase={value:Number(coat.key.toFixed(1))};
     shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 ratRest;').replace('#include <begin_vertex>','#include <begin_vertex>\nratRest = position;');
     const pattern=coat.pattern==='hooded'?'1.0-smoothstep(-.04,.2,ratRest.x)':coat.pattern==='patches'?`smoothstep(.1,.65,sin(ratRest.x*13.0+ratPatternPhase)*cos(ratRest.z*19.0)+sin(ratRest.y*22.0))`:coat.pattern==='dots'?'1.0-smoothstep(.19,.29,length(fract(ratRest.xz*8.0)-.5))':coat.pattern==='lightning'?'1.0-smoothstep(.025,.06,abs(ratRest.z-(.1*abs(mod((ratRest.x+.7)*7.0,2.0)-1.0)-.05)))':'0.0';
     shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 ratRest;uniform vec3 ratDorsal;uniform vec3 ratBelly;uniform vec3 ratAccent;uniform float ratPatternPhase;').replace('#include <color_fragment>',`#include <color_fragment>\nfloat belly=1.0-smoothstep(.22,.40,ratRest.y);diffuseColor.rgb*=mix(mix(ratDorsal,ratAccent,${pattern}),ratBelly,belly);`);
    };
    material.customProgramCacheKey=()=>`rat-${coat.pattern}-uniform-v2`;o.material=material;this.materials.push(material);
   }
  });
  // All seven meshes use the same joint table; share its GPU bone texture per rat.
  const skeleton=this.meshes[0]?.skeleton;
  if(skeleton)for(const mesh of this.meshes){
    if(mesh.skeleton===skeleton)continue;
    if(mesh.skeleton.bones.every((b,i)=>b===skeleton.bones[i])){mesh.skeleton.dispose();mesh.skeleton=skeleton;}
  }
 }
 update(dt:number,distance:number,moving:boolean,speed:number,reduced:boolean,reset:boolean,eyesOpen:boolean,pregnant:boolean,social:boolean,ground?:Ground,treadmill=false,wheel=false,environmentCollision=false,encounter?:{blend:number;frontHeight:number;rhythm?:number},distress=0){
  this.model.position.x=wheel?-.10:0;
  this.model.position.y=wheel?.09:-.02;
  const profile=qualityProfiles[this.qualityLevel];
  // Keep close-up detail within the GPU budget. All LODs retain anatomy and joints.
  const level=Math.max(distance<12?0:distance<26?1:2,profile.minLod);
  if(level!==this.lod){for(const o of this.meshes){o.geometry=this.levels[level].get(o.name)!;o.castShadow=level===0&&o.name!=='Fine_ivory_fibres';}this.lod=level;this.root.userData.lod=level;}
  for(const mesh of this.meshes)if(mesh.name==='Fine_ivory_fibres')mesh.visible=profile.furDistance>0&&distance<profile.furDistance;
  if(reset)this.elapsed=0;else if(!reduced)this.elapsed+=dt;
  for(const [name,bone] of this.bones){bone.quaternion.copy(this.rest.get(name)!);bone.position.copy(this.restPositions.get(name)!);}
  this.bodyMotion.update(dt,moving||treadmill?speed:0,this.motor.supportState(),false,reduced,reset,wheel);
  this.naturalMotion.update(dt,moving||treadmill||social,reduced,reset,wheel||social?0:distress);
  this.model.scale.z=.8*(pregnant?1.13:1);
  if(encounter?.rhythm&&!reduced){
   // Pelvis articulation precedes IK: feet remain supported instead of following the hip.
   for(const [name,angle] of [['pelvis',.055],['chest',-.018],['head',.009]] as const){
    const bone=this.bones.get(name)!;
    const axis=new T.Vector3(0,0,1).transformDirection(this.model.matrixWorld).applyQuaternion(bone.getWorldQuaternion(new T.Quaternion()).invert());
    bone.quaternion.multiply(new T.Quaternion().setFromAxisAngle(axis,angle*encounter.rhythm));
    bone.updateWorldMatrix(false,true);
   }
  }
  const flat=this.root.parent?.position.y??0;
  this.motor.update(dt,ground??(()=>flat),reduced,reset,treadmill?speed:0,encounter);

  this.tailCollision.update(dt,ground??(()=>flat),(environmentCollision||!!encounter)&&!wheel,reset,environmentCollision);
  for(const o of this.meshes)if(o.name==='Ruby_black_eyes')o.visible=eyesOpen;
  this.model.scale.z=.8*(pregnant?1.13:1);
 }
 naturalDiagnostics(){return this.naturalMotion.diagnostics();}
 diagnostics(){return this.motor.diagnostics();}
 dispose(){const skeletons=new Set<T.Skeleton>();this.model.traverse(o=>{if(o instanceof T.SkinnedMesh)skeletons.add(o.skeleton);});skeletons.forEach(s=>s.dispose());this.materials.forEach(m=>m.dispose());this.root.removeFromParent();this.root.clear();}
}
