import assert from 'node:assert/strict';import {readFileSync,writeFileSync} from 'node:fs';import {createHash} from 'node:crypto';import * as T from 'three';import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';import {clone} from 'three/addons/utils/SkeletonUtils.js';
import {StudyFootMotor} from '../src/render/StudyFootMotor';
import {StudyBodyMotion} from '../src/render/StudyBodyMotion';
const b=readFileSync('public/models/rat-gait-study.glb'),g=await new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');const results:Record<string,string>={};
for(const fps of [30,60,120])for(const kind of ["flat","slope","wheel","mating"]){
 const model=clone(g.scene);new T.Group().add(model);const bones=new Map<string,T.Bone>();model.traverse(o=>{if(o instanceof T.Bone)bones.set(o.name,o)});const motor=new StudyFootMotor(model,bones),body=new StudyBodyMotion(bones),hash=createHash('sha256');
 for(let frame=0;frame<fps*8;frame++){
  const t=frame/fps;model.parent!.position.x=t*.22;model.parent!.rotation.y=Math.sin(t)*.5;body.update(1/fps,kind==="wheel"?.6:.22,motor.supportState(),false,false,frame===0,kind==="wheel");motor.update(1/fps,(x,z)=>kind==="slope"?Math.sin(x)*.03+z*.02:0,false,frame===0,kind==="wheel"?.6:0,kind==="mating"?{blend:.8,frontHeight:.5}:undefined);
  const pose:number[]=[];for(const bone of bones.values())pose.push(...bone.position.toArray(),...bone.quaternion.toArray());for(const f of motor.diagnostics())pose.push(f.contact,Number(f.swing),f.support,...f.actual,...f.target);hash.update(JSON.stringify(pose.map(v=>Math.round(v*1e6))));
 }
 results[fps+'-'+kind]=hash.digest('hex');
}
const expected=JSON.parse(readFileSync('scripts/fixtures/foot-matrix-poses.json','utf8'));assert.deepEqual(results,expected.cases);console.log('PASS: original pose hashes preserved at 30/60/120 FPS on flat/sloped terrain, treadmill and paired poses, including contact phases and all joints');
