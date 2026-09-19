import * as T from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {SnakeDen} from './SnakeDen';
import {BlenderRatAssets} from './BlenderRat';
import {createWorld} from '../sim/colony';
import {SNAKE_DEN} from '../sim/snake';
export async function showSnakeStudio(host:HTMLElement){
 document.title='RATTERY · Snake preview';
 host.innerHTML='<div style="position:fixed;inset:0;background:#171812;color:#eee;font:14px system-ui"><div style="position:absolute;top:20px;left:24px;z-index:2"><a href="/" style="color:inherit">← Colony</a><h2>Eyes in the dark</h2><p>Isolated preview · No real rats or tokens affected</p><button id="snake-replay">Replay encounter</button> <button id="snake-pause">Pause</button><label style="display:block;margin-top:12px">Animation <input id="snake-time" type="range" min="0" max="11.9" step=".1" value="0"></label><p id="snake-status">Loading…</p></div></div>';
 const shell=host.firstElementChild as HTMLElement,renderer=new T.WebGLRenderer({antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.setSize(innerWidth,innerHeight);renderer.localClippingEnabled=true;renderer.toneMapping=T.ACESFilmicToneMapping;shell.prepend(renderer.domElement);
 const scene=new T.Scene();scene.background=new T.Color(0x171812);scene.add(new T.HemisphereLight(0xffebce,0x30251d,2));const light=new T.DirectionalLight(0xffdfab,3);light.position.set(5,9,3);scene.add(light);
 const den=new SnakeDen(scene),camera=new T.PerspectiveCamera(40,innerWidth/innerHeight,.1,150),orbit=new OrbitControls(camera,renderer.domElement);orbit.target.copy(den.root.position).add(new T.Vector3(.7,.2,0));camera.position.copy(orbit.target).add(new T.Vector3(5,5,7));orbit.update();
 const ground=new T.Mesh(new T.PlaneGeometry(100,100),new T.MeshStandardMaterial({color:0x897350,roughness:1}));ground.rotation.x=-Math.PI/2;ground.position.y=-.05;scene.add(ground);
 const assets=await BlenderRatAssets.load(),rat=assets.create('snake-preview');scene.add(rat.root);const models=new Map([['preview',rat]]),world=createWorld();let elapsed=0,last=performance.now(),paused=matchMedia('(prefers-reduced-motion: reduce)').matches;
 shell.querySelector<HTMLButtonElement>('#snake-replay')!.onclick=()=>{elapsed=0;paused=false;};shell.querySelector<HTMLButtonElement>('#snake-pause')!.onclick=()=>{paused=!paused;};
 shell.querySelector<HTMLInputElement>('#snake-time')!.oninput=e=>{elapsed=Number((e.target as HTMLInputElement).value);paused=true;};
 renderer.setAnimationLoop(now=>{const dt=Math.min(.05,(now-last)/1000);last=now;if(!paused)elapsed+=dt;const t=elapsed%12;rat.root.visible=t<9;rat.root.rotation.set(0,0,0);rat.root.position.copy(den.root.position).add(new T.Vector3(2.6-Math.min(t,3)*.2,0,.25));rat.update(dt,4,t<3,.18,false,false,true,false,true,()=>0,false,false,false);
 world.snake={nextAttack:0,...(t>=3&&t<9?{capture:{ratId:'preview',started:0,x:SNAKE_DEN.x+60,y:SNAKE_DEN.y+7.5}}:{})};den.update(world,models,(t-3)/60,false);shell.querySelector('#snake-status')!.textContent=t<3?'Approaching':t<4.5?'Strike':t<9?'Retreat':'Back in the dark';shell.dataset.ready='true';orbit.update();renderer.render(scene,camera);});
 addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);});
}
