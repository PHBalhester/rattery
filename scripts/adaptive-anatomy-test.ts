import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {qualityProfiles} from '../src/render/AdaptiveQuality';
import {BlenderRatVisual} from '../src/render/BlenderRat';
const sources=await Promise.all(['study','medium','far'].map(async name=>{const b=readFileSync(`public/models/rat-gait-${name}.glb`);return new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');}));
const levels=sources.map(g=>{const result=new Map<string,T.BufferGeometry>();g.scene.traverse(o=>{if(o instanceof T.SkinnedMesh)result.set(o.name,o.geometry)});return result;});
for(const quality of [0,1,2,3])for(const distance of [5,20,50]){
 const reference=new BlenderRatVisual(sources[0],levels,'quality-test'),adaptive=new BlenderRatVisual(sources[0],levels,'quality-test');
 new T.Group().add(reference.root);new T.Group().add(adaptive.root);adaptive.qualityLevel=quality;
 for(let frame=0;frame<120;frame++){
  for(const rat of [reference,adaptive]){rat.root.position.x=frame*.004;rat.root.rotation.y=Math.sin(frame*.02)*.3;rat.update(1/60,distance,true,.4,false,frame===0,true,false,false,()=>0,false,false,true);}
  assert.deepEqual(adaptive.diagnostics(),reference.diagnostics(),'quality must not change foot articulation');
  const bones=(rat:BlenderRatVisual)=>{const poses:number[][]=[];rat.root.traverse(o=>{if(o instanceof T.Bone)poses.push([...o.position.toArray(),...o.quaternion.toArray()])});return poses;};
  assert.deepEqual(bones(adaptive),bones(reference),'quality must preserve pelvis, chest, head and tail articulation');
 }
 const a=new Map<string,boolean>(),b=new Map<string,boolean>();reference.root.traverse(o=>{if(o instanceof T.SkinnedMesh)a.set(o.name,o.visible)});adaptive.root.traverse(o=>{if(o instanceof T.SkinnedMesh)b.set(o.name,o.visible)});
 for(const [name,visible] of a)if(name!=='Fine_ivory_fibres')assert.equal(b.get(name),visible,'anatomy visibility '+name);
 assert.equal(a.size,b.size);
 const expectedLod=Math.max(distance<12?0:distance<26?1:2,qualityProfiles[quality].minLod);
 assert.equal(adaptive.root.userData.lod,expectedLod);
 adaptive.root.traverse(o=>{if(o instanceof T.SkinnedMesh)assert.equal(o.geometry,levels[expectedLod].get(o.name),'quality mesh');});
 if(quality>=2)assert.equal(b.get('Fine_ivory_fibres'),false,'fallback disables close-up fine fur');
 reference.dispose();adaptive.dispose();
}
console.log('PASS: four quality levels x three LOD distances; exact foot-motion equality over 120 frames each; only optional fur visibility changes');
