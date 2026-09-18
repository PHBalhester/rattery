import {AdaptiveQuality} from './AdaptiveQuality';
import {addCourtyard} from './Courtyard';
import {RatNameLabels} from './RatNameLabels';
import {displayedRat,displayedDay} from '../store';
import {tr,useLanguage} from '../i18n';
import {BlenderRatAssets} from './BlenderRat';
import { useEffect, useRef, useState } from 'react';
import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { getWorld, useStore } from '../store';
import { CONFIG } from '../config';
import { NEST_POS } from '../sim/colony';
import {RatAssets,RatModel} from './RatModel';
import {habitatRoutes,tunnelRoutes,lateralRoutes} from '../sim/habitatLayout';
import {addEnrichment} from './Enrichment';
import CatchupOverlay from './CatchupOverlay';

export default function Burrow3D(){
 useLanguage(s=>s.language);
 const host=useRef<HTMLDivElement>(null),action=useRef<(s:string)=>void>(()=>{});
 const [error,setError]=useState(false);
 const [motionStatus,setMotionStatus]=useState('Carregando animação…');
 const [reducedMotion,setReducedMotion]=useState(false);
 const motionOverride=useRef(false);
 const catchingUp=useStore(s=>s.feedStatus==='catchup');
 useEffect(()=>{
  const el=host.current!;delete el.dataset.performance;delete el.dataset.quality;let renderer:T.WebGLRenderer;
  try{renderer=new T.WebGLRenderer({antialias:true});}catch{setError(true);return;}
  renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.setClearColor(0x080a0b);renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;el.appendChild(renderer.domElement);const names=new RatNameLabels(el);
  const contextLost=(event:Event)=>{event.preventDefault();renderer.setAnimationLoop(null);setError(true);};
  renderer.domElement.addEventListener('webglcontextlost',contextLost);
  const scene=new T.Scene(),camera=new T.PerspectiveCamera(42,1,.1,250),controls=new OrbitControls(camera,renderer.domElement);
  scene.fog=new T.FogExp2(0x080a0b,.004);controls.minDistance=3;controls.maxDistance=95;controls.maxPolarAngle=Math.PI*.48;controls.dampingFactor=.06;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const onMotionChange=()=>setReducedMotion(reduced.matches&&!motionOverride.current);onMotionChange();reduced.addEventListener('change',onMotionChange);
  setMotionStatus('Carregando animação…');
  let overview=true;
  const reset=()=>{useStore.getState().focus(null);overview=true;fitOverview();};
  scene.add(new T.HemisphereLight(0xd4dfe8,0x33241c,2));const sun=new T.DirectionalLight(0xffe4bc,3);sun.position.set(5,22,8);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);sun.shadow.bias=-.00025;sun.shadow.normalBias=.04;Object.assign(sun.shadow.camera,{left:-30,right:30,top:25,bottom:-25});scene.add(sun);
  const rim=new T.DirectionalLight(0x6c96c5,1.5);rim.position.set(-20,10,-12);scene.add(rim);
  const W=CONFIG.colony.burrowWidth,H=CONFIG.colony.burrowHeight;
  // Fit the full floor at the current aspect ratio, including its near corners.
  function fitOverview(){
   const direction=new T.Vector3(26,32,37).normalize();
   camera.position.copy(direction);camera.lookAt(0,0,0);camera.updateMatrixWorld();
   const inverse=camera.quaternion.clone().invert();
   const tanY=Math.tan(T.MathUtils.degToRad(camera.fov/2)),tanX=tanY*camera.aspect;
   let distance=0;
   for(const x of [-W/60,W/60])for(const z of [-H/60,H/60])for(const y of [-1.5,1.5]){
    const p=new T.Vector3(x,y,z).applyQuaternion(inverse);
    distance=Math.max(distance,p.z+Math.max(Math.abs(p.x)/tanX,Math.abs(p.y)/tanY)*1.12);
   }
   controls.maxDistance=Math.max(95,distance*1.5);camera.far=Math.max(250,distance*3);
   camera.position.copy(direction.multiplyScalar(distance));controls.target.set(0,0,0);camera.updateProjectionMatrix();controls.update();
  }
  reset();
  const point=(x:number,y:number,h=0)=>new T.Vector3((x-W/2)/30,h,(y-H/2)/30);
  const legacyScenery=new T.Group(),legacyEnrichment=new T.Group();scene.add(legacyScenery,legacyEnrichment);
  let disposed=false;
  const soil=new T.MeshStandardMaterial({color:0x322b24,roughness:1}),wall=new T.MeshStandardMaterial({color:0x574537,roughness:1,side:T.DoubleSide});
  const floor=new T.Mesh(new T.BoxGeometry(W/30,1.3,H/30),soil);floor.position.y=-.8;floor.receiveShadow=true;legacyScenery.add(floor);
  const grid=new T.GridHelper(Math.max(W,H)/30,32,0x4d4437,0x292722);grid.position.y=-.13;legacyScenery.add(grid);
  const nest=point(NEST_POS.x,NEST_POS.y);
  for(const route of tunnelRoutes){
   const end=point(route[route.length-1].x,route[route.length-1].z),curve=new T.CatmullRomCurve3(route.map(p=>point(p.x,p.z))),positions:number[]=[],indices:number[]=[];
   for(let i=0;i<=48;i++){const p=curve.getPoint(i/48),t=curve.getTangent(i/48),side=new T.Vector3(-t.z,0,t.x);for(let j=0;j<=12;j++){const a=j/12*Math.PI,q=p.clone().addScaledVector(side,Math.cos(a)*1.25);positions.push(q.x,1.15-Math.sin(a)*1.25,q.z);}}
   for(let i=0;i<48;i++)for(let j=0;j<12;j++){const a=i*13+j;indices.push(a,a+13,a+1,a+1,a+13,a+14);}
   const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(positions,3));geo.setIndex(indices);geo.computeVertexNormals();const tunnel=new T.Mesh(geo,wall);tunnel.receiveShadow=true;tunnel.castShadow=true;legacyScenery.add(tunnel);
   const chamber=new T.Mesh(new T.CylinderGeometry(2.1,2.4,.3,48),soil);chamber.position.copy(end);chamber.position.y=-.05;chamber.receiveShadow=true;legacyScenery.add(chamber);
  }
  // Open lateral passages share exactly the navigation centerlines.
  for(const route of lateralRoutes){const curve=new T.CatmullRomCurve3(route.map(p=>point(p.x,p.z,-.08)));const path=new T.Mesh(new T.TubeGeometry(curve,80,.38,6,false),soil);path.scale.y=.12;path.receiveShadow=true;legacyScenery.add(path);}
  const bed=new T.Mesh(new T.CylinderGeometry(2.7,3,.28,64),new T.MeshStandardMaterial({color:0x796044,roughness:1}));bed.position.copy(nest);legacyScenery.add(bed);
  const nestRim=new T.Mesh(new T.TorusGeometry(2.65,.13,8,80),wall);nestRim.rotation.x=Math.PI/2;nestRim.position.copy(nest);nestRim.position.y=.2;legacyScenery.add(nestRim);
  const straw=new T.BufferGeometry(),strawPoints:number[]=[];for(let i=0;i<160;i++){const a=i*2.39996,r=2.5*Math.sqrt(i/160),x=nest.x+Math.cos(a)*r,z=nest.z+Math.sin(a)*r;strawPoints.push(x,.17,z,x+Math.sin(i)*.4,.17,z+Math.cos(i)*.4);}straw.setAttribute('position',new T.Float32BufferAttribute(strawPoints,3));legacyScenery.add(new T.LineSegments(straw,new T.LineBasicMaterial({color:0xb39460,transparent:true,opacity:.5})));
  const enrichment=addEnrichment(scene,legacyEnrichment);const disposeCourtyard=addCourtyard(scene);
  const disposeModel=(model:T.Object3D)=>{const geometries=new Set<T.BufferGeometry>(),materials=new Set<T.Material>();model.traverse(o=>{if(o instanceof T.Mesh){geometries.add(o.geometry);(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>materials.add(m));}});geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());};
  new GLTFLoader().load('/models/habitat.glb',gltf=>{
   if(disposed){disposeModel(gltf.scene);return;}
   gltf.scene.name='Blender habitat';gltf.scene.traverse(o=>{if(o instanceof T.Mesh){o.castShadow=true;o.receiveShadow=true;}});
   scene.add(gltf.scene);legacyScenery.visible=false;legacyEnrichment.visible=false;el.dataset.habitat='blender';
  },undefined,()=>{if(!disposed)el.dataset.habitat='fallback';});
  const assets=new RatAssets(),rats=new Map<string,RatModel>(),deathPoses=new Map<string,{at:number;y:number}>();
  let blenderRats:BlenderRatAssets|undefined;
  BlenderRatAssets.load().then(loaded=>{
    if(disposed){loaded.dispose();return;}blenderRats=loaded;
    for(const rat of rats.values())rat.attachBlender(loaded);
    el.dataset.rats='blender';el.dataset.motionRevision='GAIT-12';setMotionStatus('Movimentos naturais · 12');
    if(new URLSearchParams(location.search).has('inspect-motion')){const first=Object.values(getWorld().rats).find(r=>r.deadAt===null);if(first)useStore.getState().focus(first.id);}
  }).catch(error=>{if(!disposed){el.dataset.rats='fallback';setMotionStatus('Modelo de reserva · animação nova indisponível');console.warn('Rattery: falha ao carregar movimento Blender',error);}});
  const ring=new T.Mesh(new T.RingGeometry(.65,.7,48),new T.MeshBasicMaterial({color:0xe8c36a,side:T.DoubleSide}));ring.rotation.x=-Math.PI/2;ring.visible=false;scene.add(ring);
  const ray=new T.Raycaster();let down=[0,0];const pointerDown=(e:PointerEvent)=>{down=[e.clientX,e.clientY];};
  const pointerUp=(e:PointerEvent)=>{if(useStore.getState().feedStatus==='catchup'||e.button!==0||Math.hypot(e.clientX-down[0],e.clientY-down[1])>5)return;const b=el.getBoundingClientRect();ray.setFromCamera(new T.Vector2((e.clientX-b.left)/b.width*2-1,-(e.clientY-b.top)/b.height*2+1),camera);const hit=ray.intersectObjects([...rats.values()].map(m=>m.root),true)[0];let obj:T.Object3D|null=hit?.object??null;while(obj&&!obj.userData.id)obj=obj.parent;useStore.getState().focus(obj?.userData.id??null);};
  const onControlStart=()=>{overview=false;useStore.getState().focus(null);};
  renderer.domElement.addEventListener('pointerdown',pointerDown);renderer.domElement.addEventListener('pointerup',pointerUp);controls.addEventListener('start',onControlStart);
  let playArea=0;
  action.current=v=>{if(v==='reset')reset();else {overview=false;if(v==='play'){useStore.getState().focus(null);const p=habitatRoutes[playArea++%habitatRoutes.length][74];controls.target.copy(point(p.x,p.z));camera.position.copy(controls.target).add(new T.Vector3(5,7,8));}else if(v==='nest'){useStore.getState().focus(null);controls.target.copy(nest);camera.position.copy(nest).add(new T.Vector3(5,8,9));}else camera.position.sub(controls.target).multiplyScalar(v==='in'?.8:1.25).clampLength(3,controls.maxDistance).add(controls.target);}controls.update();};
  const resize=()=>{const w=el.clientWidth,h=el.clientHeight;if(!w||!h)return;renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();if(overview)fitOverview();};const observer=new ResizeObserver(resize);observer.observe(el);resize();
  const quality=new AdaptiveQuality();
  const inspect=new URLSearchParams(location.search).has('inspect-performance');
  const performanceLabel=inspect?document.createElement('div'):null;
  if(performanceLabel){performanceLabel.className='performance-readout';performanceLabel.style.cssText='position:fixed;top:calc(env(safe-area-inset-top, 0px) + 84px);left:50%;transform:translateX(-50%);padding:6px 10px;background:#000b;color:#ddd;pointer-events:none;font:12px monospace;z-index:90;max-width:calc(100vw - 16px);white-space:nowrap';document.body.appendChild(performanceLabel);}
  function applyQuality(){const profile=quality.profile;renderer.setPixelRatio(Math.min(devicePixelRatio,profile.pixelRatio));renderer.shadowMap.enabled=profile.shadows;sun.castShadow=profile.shadows;
   if(sun.shadow.mapSize.x!==profile.shadowSize){sun.shadow.map?.dispose();sun.shadow.map=null;sun.shadow.mapSize.set(profile.shadowSize,profile.shadowSize);}
   renderer.shadowMap.needsUpdate=true;el.dataset.quality=profile.name;
  }
  applyQuality();let telemetryAt=performance.now(),telemetryFrames=0;
  const onVisibility=()=>{previousTime=performance.now();telemetryAt=previousTime;telemetryFrames=0;quality.resetWindow();};
  document.addEventListener('visibilitychange',onVisibility);
  let previousTime=performance.now(),previousDay=getWorld().simDay,wasCatchingUp=false;
  let lastFocused:string|null=null;
  renderer.setAnimationLoop(time=>{
   if(document.hidden){previousTime=time;return;}
   const frameMs=time-previousTime;if(quality.sample(frameMs))applyQuality();
   const world=getWorld(),replaying=useStore.getState().feedStatus==='catchup';
   const dt=Math.max(0,Math.min((time-previousTime)/1000,.1));previousTime=time;
   const discontinuity=replaying||wasCatchingUp||world.simDay<previousDay||world.simDay-previousDay>.25;
   if(world.simDay<previousDay){for(const m of rats.values())m.dispose();rats.clear();deathPoses.clear();}
   previousDay=world.simDay;wasCatchingUp=replaying;
   for(const r of Object.values(world.rats)){
    if(r.deadAt!==null)continue;
    let m=rats.get(r.id);if(!m){m=new RatModel(assets,r.id,r.id==='F1');rats.set(r.id,m);if(blenderRats)m.attachBlender(blenderRats);scene.add(m.root);}
    m.setRenderQuality(quality.level);
    m.sync(displayedRat(r),displayedDay(),dt,time/1000,reduced.matches&&!motionOverride.current,discontinuity,camera);
   }
   for(const [id,m] of rats)if(!world.rats[id]||world.rats[id].deadAt!==null){
    const deadAt=world.rats[id]?.deadAt??world.memorial?.[id]?.deadAt;
    if(discontinuity||deadAt==null){m.dispose();rats.delete(id);deathPoses.delete(id);continue;}
    let pose=deathPoses.get(id);
    if(!pose){pose={at:time,y:m.root.position.y};deathPoses.set(id,pose);}
    const age=(time-pose.at)/1000;
    if(age>=6){m.dispose();rats.delete(id);deathPoses.delete(id);continue;}
    const fall=reduced.matches?1:Math.min(1,age/.8),ease=fall*fall*(3-2*fall);
    m.root.rotation.z=Math.PI*.48*ease;m.root.position.y=pose.y+m.root.scale.x*.2*ease;
   }
   const focused=useStore.getState().focusedId,selected=focused&&world.rats[focused]?.deadAt===null?rats.get(focused)?.root:null;
   ring.visible=!!selected&&!replaying;
   if(selected&&!replaying){
    overview=false;
    if(focused!==lastFocused){const direction=camera.position.clone().sub(controls.target).normalize();controls.target.copy(selected.position);camera.position.copy(selected.position).addScaledVector(direction,Math.max(3,selected.scale.x*5));}
    ring.position.copy(selected.position);ring.position.y+=.02;
    camera.position.add(selected.position.clone().sub(controls.target));controls.target.copy(selected.position);
   }
   lastFocused=focused;enrichment.update(world,dt,reduced.matches&&!motionOverride.current);controls.enableDamping=!reduced.matches||motionOverride.current;controls.update();names.begin();if(!replaying)for(const [id,m]of rats){const rat=world.rats[id];const petAt=rat.petAt??((world.care?.cooldowns[id+':pet']??0)-3600000),petting=Date.now()>=petAt&&Date.now()-petAt<15000;if(world.care?.owners[id]||rat.minted||petting)names.show(id,petting?'♡ '+rat.name+' · '+tr('Gentle petting','温柔抚摸'):(rat.caregiver?'◇ ':'')+rat.name+(rat.residenceDays?' · '+rat.residenceDays+'d':''),m.root,camera,petting);}names.end();renderer.render(scene,camera);
   telemetryFrames++;if(time-telemetryAt>=1000){const fps=telemetryFrames*1000/(time-telemetryAt);const info={fps:Math.round(fps*10)/10,quality:quality.profile.name,rats:rats.size,drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,geometries:renderer.info.memory.geometries,textures:renderer.info.memory.textures,pixelRatio:renderer.getPixelRatio()};el.dataset.performance=JSON.stringify(info);if(performanceLabel)performanceLabel.textContent=`${info.fps} FPS · ${info.quality} · ${info.rats} rats`;telemetryAt=time;telemetryFrames=0;}

  });
  return()=>{document.removeEventListener('visibilitychange',onVisibility);performanceLabel?.remove();disposeCourtyard();names.dispose();disposed=true;reduced.removeEventListener('change',onMotionChange);renderer.domElement.removeEventListener('webglcontextlost',contextLost);observer.disconnect();renderer.setAnimationLoop(null);controls.removeEventListener('start',onControlStart);controls.dispose();renderer.domElement.removeEventListener('pointerdown',pointerDown);renderer.domElement.removeEventListener('pointerup',pointerUp);for(const m of rats.values())m.dispose();rats.clear();blenderRats?.dispose();assets.dispose();const gs=new Set<T.BufferGeometry>(),ms=new Set<T.Material>();scene.traverse(o=>{if(o instanceof T.Mesh||o instanceof T.LineSegments){gs.add(o.geometry);(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>ms.add(m));}});gs.forEach(g=>g.dispose());ms.forEach(m=>m.dispose());rats.clear();sun.shadow.dispose();renderer.dispose();renderer.forceContextLoss();renderer.domElement.remove();action.current=()=>{};};
 },[]);
 return <><div className={`burrow-host${catchingUp ? ' is-catching-up' : ''}`} ref={host} aria-label="Interactive 3D colony" />{error&&<p className="render-error">3D unavailable. Enable WebGL to view the colony.</p>}<CatchupOverlay /><div className="scene-controls"><span className="motion-version" role="status">{motionStatus.includes('12')?tr('Natural motion · 12','自然动作 · 12'):motionStatus.includes('reserva')?tr('Fallback model','备用模型'):tr('Loading animation…','正在加载动画…')}{reducedMotion?tr(' · reduced motion',' · 减少动态效果'):''}</span>{reducedMotion&&<button onClick={()=>{motionOverride.current=true;setReducedMotion(false);}}>{tr("Enable animation","启用动画")}</button>}<button onClick={()=>action.current('in')} aria-label="Zoom in">+</button><button onClick={()=>action.current('out')} aria-label="Zoom out">−</button><button onClick={()=>action.current('nest')}>{tr("Nest","巢穴")}</button><button onClick={()=>action.current('play')}>{tr("Play areas","活动区")}</button><button onClick={()=>action.current('reset')}>{tr("Overview","总览")}</button><button onClick={()=>{const first=Object.values(getWorld().rats).find(r=>r.deadAt===null);if(first)useStore.getState().focus(first.id);}}>{tr("View rat","查看大鼠")}</button></div></>;
}




