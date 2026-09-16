import {StudyBodyMotion} from './StudyBodyMotion';

import {StudyFootMotor} from './StudyFootMotor';
import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';

export async function showGaitStudio(host:HTMLElement){
  document.title='Rattery · Estudo de marcha · 09';
  host.innerHTML=`<div id="rat-studio" style="position:fixed;inset:0;background:#d7d3cb;color:#292724;font-family:system-ui;z-index:1000">
    <div style="position:absolute;left:24px;top:20px;z-index:2;max-width:calc(100% - 48px)"><a href="/" style="color:inherit">← Colônia</a><h1 style="font-size:22px;margin:16px 0 6px">Estudo de marcha · 09 · Blender</h1><p style="font-size:13px;margin:0">Arraste para girar · Role para aproximar · <a href="/?view=rat-studio" style="color:inherit">Modelo anterior</a></p></div>
    <div style="position:absolute;bottom:24px;left:24px;right:24px;z-index:2;display:flex;gap:8px;flex-wrap:wrap" id="studio-controls">
    <button data-clip="Idle">Repouso</button><button data-clip="Sniff">Farejar</button><button data-clip="Walk">Caminhada</button><label>Ritmo <input id="study-speed" aria-label="Ritmo" type="range" min="0.15" max="0.7" step="0.05" value="0.35"></label><button id="studio-side">Vista lateral</button><button id="studio-pause">Pausar</button><button id="studio-front">Vista frontal</button><span id="studio-status" role="status" style="font-size:12px;width:100%">Carregando modelo…</span></div></div>`;
  const shell=host.querySelector<HTMLElement>('#rat-studio')!;
  shell.querySelectorAll('button').forEach(b=>b.style.cssText='background:#fff8;border:1px solid #7776;color:#292724;padding:10px 15px;border-radius:3px;cursor:pointer');
  const status=shell.querySelector<HTMLElement>('#studio-status')!;
  const scene=new T.Scene();scene.background=new T.Color('#d7d3cb');
  const renderer=new T.WebGLRenderer({antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.setSize(innerWidth,innerHeight);renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;shell.prepend(renderer.domElement);
  const camera=new T.PerspectiveCamera(35,innerWidth/innerHeight,.02,50);camera.position.set(2.6,1.65,3.8).multiplyScalar(Math.max(1,1.3/camera.aspect));
  const orbit=new OrbitControls(camera,renderer.domElement);orbit.target.set(-.2,.5,0);orbit.enableDamping=true;orbit.minDistance=1.4;orbit.maxDistance=18;orbit.maxPolarAngle=Math.PI*.49;orbit.update();
  shell.querySelector<HTMLButtonElement>('#studio-front')!.onclick=()=>{camera.position.set(4,1.05,0).multiplyScalar(Math.max(1,1.3/camera.aspect));orbit.target.set(.0,.4,0);orbit.update();};
  scene.add(new T.HemisphereLight(0xffffff,0x8a8171,2));
  const key=new T.DirectionalLight(0xfff7ee,3);key.position.set(2,4,3);key.castShadow=true;key.shadow.mapSize.set(2048,2048);key.shadow.camera.left=-3;key.shadow.camera.right=3;key.shadow.camera.top=3;key.shadow.camera.bottom=-3;key.shadow.normalBias=.015;scene.add(key);
  const fill=new T.DirectionalLight(0xe1e9ff,1.1);fill.position.set(-2,2,-3);scene.add(fill);
  const floor=new T.Mesh(new T.PlaneGeometry(200,200),new T.MeshStandardMaterial({color:'#d7d3cb',roughness:1}));floor.rotation.x=-Math.PI/2;floor.position.y=-.006;floor.receiveShadow=true;scene.add(floor);
  try{
    const gltf=await new GLTFLoader().loadAsync('/models/rat-gait-study.glb');scene.add(gltf.scene);
    const rigBones=new Map<string,T.Bone>();gltf.scene.traverse(o=>{if(o instanceof T.Bone)rigBones.set(o.name,o);});

    const bodyMotion=new StudyBodyMotion(rigBones);
    const footMotor=new StudyFootMotor(gltf.scene,rigBones);gltf.scene.position.y=-.02;
    let meshes=0,bones=0;gltf.scene.traverse(o=>{if(o instanceof T.Mesh){meshes++;o.castShadow=o.name!=='Fine_ivory_fibres';o.receiveShadow=o.name!=='Fine_ivory_fibres';}if(o instanceof T.Bone)bones++;});
    const play=(name:string)=>{shell.dataset.animation=name;};
    play('Walk');shell.querySelectorAll<HTMLButtonElement>('[data-clip]').forEach(b=>b.onclick=()=>play(b.dataset.clip!));
    let paused=false;const pause=shell.querySelector<HTMLButtonElement>('#studio-pause')!;pause.onclick=()=>{paused=!paused;pause.textContent=paused?'Continuar':'Pausar';};
    status.textContent='Protótipo 09 · quadril e peito independentes · cauda de 6 segmentos · apoio por fases';
    shell.querySelector<HTMLButtonElement>('#studio-side')!.onclick=()=>{camera.position.set(0,1.1,4).multiplyScalar(Math.max(1,1.3/camera.aspect));orbit.target.set(-.2,.45,0);orbit.update();};
    shell.dataset.ready='true';shell.dataset.meshes=String(meshes);shell.dataset.bones=String(bones);shell.dataset.clips=gltf.animations.map(a=>a.name).join(',');
    let last=performance.now();renderer.setAnimationLoop(now=>{const dt=Math.min((now-last)/1000,.05);last=now;if(!paused){const speed=shell.dataset.animation==='Walk'?Number(shell.querySelector<HTMLInputElement>('#study-speed')!.value):0;bodyMotion.update(dt,speed,footMotor.diagnostics(),shell.dataset.animation==='Sniff');footMotor.update(dt,()=>0,false,false,speed);}orbit.update();renderer.render(scene,camera);});
  }catch(error){status.textContent='Não foi possível carregar o modelo.';shell.dataset.ready='error';console.error(error);}
  addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);});
}
