import * as T from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {BlenderRatAssets} from './BlenderRat';
import {addEnrichment} from './Enrichment';
import {toyApproaches,wheelToys} from '../sim/habitatLayout';
import {playActivity} from '../sim/playActivity';
import {createWorld} from '../sim/colony';
import {CONFIG} from '../config';
export async function showWheelStudio(host:HTMLElement){
 document.title='Rattery · Rato na rodinha';
 host.innerHTML='<div style="position:fixed;inset:0;background:#24231e" id="wheel-studio"><div style="position:absolute;top:24px;left:24px;z-index:2;color:white;font:14px system-ui"><a href="/" style="color:inherit">← Voltar à colônia</a><h2>Rato na rodinha</h2><p>Demonstração visual · arraste para girar · role para aproximar</p><button id="wheel-pause">Pausar</button><p id="wheel-status">Carregando…</p></div></div>';
 const shell=host.querySelector<HTMLElement>('#wheel-studio')!,status=shell.querySelector<HTMLElement>('#wheel-status')!;
 const renderer=new T.WebGLRenderer({antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.setSize(innerWidth,innerHeight);renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;renderer.toneMapping=T.ACESFilmicToneMapping;shell.prepend(renderer.domElement);
 const scene=new T.Scene();scene.background=new T.Color('#24231e');
 const camera=new T.PerspectiveCamera(38,innerWidth/innerHeight,.05,200),controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.minDistance=3;controls.maxDistance=12;controls.maxPolarAngle=Math.PI*.48;
 const approach=toyApproaches.find(a=>wheelToys.has(a.toy))!;
 const center=new T.Vector3((approach.contact.x-CONFIG.colony.burrowWidth/2)/30,0,(approach.contact.z-CONFIG.colony.burrowHeight/2)/30);
 controls.target.copy(center).add(new T.Vector3(0,.9,0));camera.position.copy(center).add(new T.Vector3(2.8,2.3,5));controls.update();
 scene.add(new T.HemisphereLight(0xffffff,0x65513a,2));const light=new T.DirectionalLight(0xffefd4,3);light.position.copy(center).add(new T.Vector3(3,6,4));light.target.position.copy(center);scene.add(light,light.target);light.castShadow=true;
 const floor=new T.Mesh(new T.PlaneGeometry(200,200),new T.MeshStandardMaterial({color:0x514839,roughness:1}));floor.rotation.x=-Math.PI/2;floor.position.y=-.1;floor.receiveShadow=true;scene.add(floor);
 const enrichment=addEnrichment(scene),world=createWorld(CONFIG.colony.seed);
 try {
  const assets=await BlenderRatAssets.load(),rat=assets.create('F1');scene.add(rat.root);rat.root.position.copy(center).setY(.035);
  playActivity.set('wheel-preview',{toy:approach.toy,kind:'wheel',since:0,until:Infinity});
  let paused=false,time=0,last=performance.now();const button=shell.querySelector<HTMLButtonElement>('#wheel-pause')!;
  button.onclick=()=>{paused=!paused;button.textContent=paused?'Continuar':'Pausar';};
  status.textContent='Rodinha · 09 · marcha articulada e cauda segmentada';shell.dataset.ready='true';
  const ground=(x:number)=>1.25-Math.sqrt(Math.max(.5,1.165**2-(x-center.x)**2));
  renderer.setAnimationLoop(now=>{const dt=Math.min(.05,(now-last)/1000);last=now;if(!paused){time+=dt;world.simDay=-time*.7/(1.2*120);rat.update(dt,4,true,.7,false,false,true,false,false,ground,true,true);enrichment.update(world,dt,false);}controls.update();renderer.render(scene,camera);});
 }catch(e){status.textContent='Falha ao carregar demonstração.';shell.dataset.ready='error';console.error(e);}
 addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);});
}
