import {RatNameLabels} from './RatNameLabels';
import * as T from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {BlenderRatAssets} from './BlenderRat';
import {encounterPose,ENCOUNTER_SECONDS} from '../sim/pairEncounter';
export async function showMatingStudio(host:HTMLElement){
 document.title='RATTERY · Courtship preview';
 host.innerHTML=`<div id="mating-studio" style="position:fixed;inset:0;background:#24231e;color:#eee;font:14px system-ui"><div style="position:absolute;top:20px;left:24px;right:24px;z-index:2;pointer-events:none"><a href="/" style="color:inherit;pointer-events:auto">← Colony</a><h2>Courtship & mating · Preview</h2><p>Two adult rats · Isolated animation study</p><p id="mating-status" role="status">Loading…</p></div><div style="position:absolute;bottom:24px;left:24px;display:flex;gap:12px;z-index:2"><button id="pause">Pause</button><button id="restart">Replay</button><button id="side">Side view</button><button id="pose">Mating posture</button></div></div>`;
 const shell=host.querySelector<HTMLElement>('#mating-studio')!,status=shell.querySelector<HTMLElement>('#mating-status')!;
 shell.querySelectorAll('button').forEach(b=>b.style.cssText='background:#181818dd;border:1px solid #666;color:#eee;padding:10px 16px;cursor:pointer');
 const renderer=new T.WebGLRenderer({antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.setSize(innerWidth,innerHeight);renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;renderer.toneMapping=T.ACESFilmicToneMapping;shell.prepend(renderer.domElement);
 const names=new RatNameLabels(shell);
 const scene=new T.Scene();scene.background=new T.Color('#24231e');
 const camera=new T.PerspectiveCamera(38,innerWidth/innerHeight,.02,50),orbit=new OrbitControls(camera,renderer.domElement);
 camera.position.set(1.8,1.8,5.5);orbit.target.set(-.25,.4,0);orbit.enableDamping=true;orbit.minDistance=2;orbit.maxDistance=camera.aspect<.8?16:9;camera.position.sub(orbit.target).multiplyScalar(1/Math.min(1,camera.aspect)).add(orbit.target);orbit.maxPolarAngle=Math.PI*.49;orbit.update();
 scene.add(new T.HemisphereLight(0xffffff,0x766550,2));const light=new T.DirectionalLight(0xffefd8,3);light.position.set(2,5,3);light.castShadow=true;light.shadow.mapSize.set(2048,2048);scene.add(light);
 const floor=new T.Mesh(new T.PlaneGeometry(40,40),new T.MeshStandardMaterial({color:'#514839',roughness:1}));floor.rotation.x=-Math.PI/2;floor.position.y=-.015;floor.receiveShadow=true;scene.add(floor);
 const resize=()=>{const prior=camera.aspect;camera.aspect=innerWidth/innerHeight;orbit.maxDistance=camera.aspect<.8?16:9;camera.position.sub(orbit.target).multiplyScalar(Math.min(1,prior)/Math.min(1,camera.aspect)).clampLength(2,orbit.maxDistance).add(orbit.target);camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);};addEventListener('resize',resize);
 try{
 const assets=await BlenderRatAssets.load(),female=assets.create('F1'),male=assets.create('mating-adult-male');scene.add(female.root,male.root);female.root.position.x=.5;
 let time=0,last=performance.now(),paused=matchMedia('(prefers-reduced-motion: reduce)').matches;
 const pause=shell.querySelector<HTMLButtonElement>('#pause')!;const label=()=>pause.textContent=paused?'Play':'Pause';label();pause.onclick=()=>{paused=!paused;label();};shell.querySelector<HTMLButtonElement>('#restart')!.onclick=()=>{time=0;paused=false;label();};shell.querySelector<HTMLButtonElement>('#side')!.onclick=()=>{camera.position.set(-.3,1.25,5.5);orbit.update();};
 const pose=(dt:number)=>{const t=time%ENCOUNTER_SECONDS,p=encounterPose(t);
 female.root.position.set(.5,0,0);female.root.scale.setScalar(1);
 male.root.position.set(.5+p.x,p.y,p.z);male.root.rotation.set(0,0,p.pitch);
 const moving=t<3||t>12;
 female.update(dt,4,false,0,false,false,true,false,true,()=>0,false,false,false,{blend:1,frontHeight:0});
 male.update(dt,4,moving,moving?.18:0,false,false,true,false,true,()=>0,moving,false,false,{blend:p.lift,frontHeight:p.frontHeight,rhythm:p.rhythm});
 status.textContent=p.phase;shell.dataset.phase=p.phase;shell.dataset.time=time.toFixed(2);
 };
 shell.querySelector<HTMLButtonElement>('#pose')!.onclick=()=>{time=8.5;paused=true;label();pose(.05);};
 pose(0);shell.dataset.ready='true';renderer.setAnimationLoop(now=>{const dt=Math.min(.05,(now-last)/1000);last=now;if(!paused){time+=dt;pose(dt);}orbit.update();names.begin();names.show('female-preview','Pump',female.root,camera);names.show('male-preview','Pons',male.root,camera);names.end();renderer.render(scene,camera);});
 }catch(error){status.textContent='Unable to load the preview.';shell.dataset.ready='error';console.error(error);}
}
