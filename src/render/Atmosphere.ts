import * as T from 'three';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {GTAOPass} from 'three/addons/postprocessing/GTAOPass.js';
import {ShaderPass} from 'three/addons/postprocessing/ShaderPass.js';
import {UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {HorizontalTiltShiftShader} from 'three/addons/shaders/HorizontalTiltShiftShader.js';
import {VerticalTiltShiftShader} from 'three/addons/shaders/VerticalTiltShiftShader.js';

/**
 * Rendering-only "miniature diorama" look: image-based light, contact shadows
 * (GTAO), tilt-shift focus, soft bloom, vignette/grain, a table under the tray
 * and drifting dust. Never reads or writes simulation state.
 */
const Finish={
 uniforms:{tDiffuse:{value:null},time:{value:0},vignette:{value:.32},grain:{value:.028}},
 vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
 fragmentShader:`uniform sampler2D tDiffuse;uniform float time,vignette,grain;varying vec2 vUv;
 float h(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);}
 void main(){vec4 c=texture2D(tDiffuse,vUv);vec2 d=vUv-.5;float v=(1.-smoothstep(.2,.85,length(d*vec2(1.15,1.))));
 c.rgb*=mix(1.-vignette,1.,v);c.rgb+=(h(vUv*vec2(1733.,997.)+fract(time))-.5)*grain;gl_FragColor=c;}`,
};

function tableTexture(){
 const c=document.createElement('canvas');c.width=c.height=512;const g=c.getContext('2d')!;
 const r=g.createRadialGradient(256,256,20,256,256,256);r.addColorStop(0,'#3a2a1c');r.addColorStop(.55,'#21170f');r.addColorStop(1,'#0b0908');
 g.fillStyle=r;g.fillRect(0,0,512,512);
 // Faint grain streaks so the table reads as wood, not a gradient.
 g.globalAlpha=.06;for(let i=0;i<220;i++){g.strokeStyle=i%3?'#000':'#6b4a2c';g.lineWidth=1+((i*7)%3);g.beginPath();const y=(i*37)%512;g.moveTo(0,y);g.bezierCurveTo(170,y+((i*13)%9)-4,340,y-((i*11)%9)+4,512,y+((i*5)%7)-3);g.stroke();}
 const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;t.anisotropy=4;return t;
}
function backdropTexture(){
 const c=document.createElement('canvas');c.width=4;c.height=256;const g=c.getContext('2d')!;
 const l=g.createLinearGradient(0,0,0,256);l.addColorStop(0,'#141a1f');l.addColorStop(.55,'#0d0f10');l.addColorStop(1,'#070605');
 g.fillStyle=l;g.fillRect(0,0,4,256);const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;return t;
}

/** World-space value noise baked into the flat habitat materials so cork, timber and flax read as real surfaces. */
export function enrichHabitatMaterials(root:T.Object3D){
 const scales:Record<string,[number,number]>={'Warm cork':[2.4,.22],'Honey timber':[.9,.16],'Dark end grain':[1.6,.2],'Natural flax':[5.5,.18],'Grain':[9,.25],'Graphite tray':[1.2,.08]};
 root.traverse(o=>{
  if(!(o instanceof T.Mesh))return;const m=o.material as T.MeshStandardMaterial;const s=scales[m.name];if(!s||m.userData.enriched)return;m.userData.enriched=true;
  m.onBeforeCompile=shader=>{
   shader.uniforms.noiseScale={value:s[0]};shader.uniforms.noiseAmount={value:s[1]};
   shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vWorldP;').replace('#include <worldpos_vertex>','#include <worldpos_vertex>\nvWorldP=(modelMatrix*vec4(transformed,1.)).xyz;');
   shader.fragmentShader=shader.fragmentShader.replace('#include <common>',`#include <common>
    varying vec3 vWorldP;uniform float noiseScale,noiseAmount;
    float hn(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}
    float vn(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
     return mix(mix(mix(hn(i),hn(i+vec3(1,0,0)),f.x),mix(hn(i+vec3(0,1,0)),hn(i+vec3(1,1,0)),f.x),f.y),mix(mix(hn(i+vec3(0,0,1)),hn(i+vec3(1,0,1)),f.x),mix(hn(i+vec3(0,1,1)),hn(i+vec3(1,1,1)),f.x),f.y),f.z);}`)
    .replace('#include <color_fragment>',`#include <color_fragment>
    vec3 q=vWorldP*noiseScale;float n=vn(q)*.55+vn(q*2.7)*.3+vn(q*7.3)*.15;
    diffuseColor.rgb*=1.+(n-.5)*2.*noiseAmount;`)
    .replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>
    roughnessFactor=clamp(roughnessFactor+(vn(vWorldP*noiseScale*3.1)-.5)*.18,.05,1.);`);
  };
  m.customProgramCacheKey=()=>'rattery-habitat-noise-v1-'+m.name;m.needsUpdate=true;
 });
}

export type AtmosphereLevel=0|1|2|3;
export class Atmosphere{
 private composer:EffectComposer;private gtao:GTAOPass;private tiltH:ShaderPass;private tiltV:ShaderPass;private bloom:UnrealBloomPass;private finish:ShaderPass;
 private env:T.WebGLRenderTarget;private table:T.Mesh;private dust:T.Points;private dustBase:Float32Array;private disposables:{dispose():void}[]=[];
 private level:AtmosphereLevel=0;private time=0;private focusY=.5;
 constructor(private renderer:T.WebGLRenderer,private scene:T.Scene,private camera:T.PerspectiveCamera,private target:T.Vector3){
  const pmrem=new T.PMREMGenerator(renderer);const room=new RoomEnvironment();this.env=pmrem.fromScene(room,.04);room.dispose();pmrem.dispose();
  scene.environment=this.env.texture;scene.environmentIntensity=.28;renderer.toneMappingExposure=.92;
  const bg=backdropTexture();scene.background=bg;(scene.fog as T.FogExp2|null)?.color.set(0x0c0d0d);
  const tex=tableTexture(),tableGeo=new T.CircleGeometry(95,96),tableMat=new T.MeshStandardMaterial({map:tex,roughness:.72,metalness:0});
  this.table=new T.Mesh(tableGeo,tableMat);this.table.rotation.x=-Math.PI/2;this.table.position.y=-1.53;this.table.receiveShadow=true;this.table.name='Atmosphere table';scene.add(this.table);
  // Dust motes above the tray, lit like particles in a lamp beam.
  const n=160,pos=new Float32Array(n*3);for(let i=0;i<n;i++){const a=(i*2654435761>>>0)/4294967296,b=((i+7)*2246822519>>>0)/4294967296,c=((i+13)*3266489917>>>0)/4294967296;pos.set([(a-.5)*60,.6+b*9,(c-.5)*34],i*3);}
  this.dustBase=pos.slice();const dg=new T.BufferGeometry();dg.setAttribute('position',new T.BufferAttribute(pos,3));
  const dm=new T.PointsMaterial({color:0xffe2b0,size:.05,transparent:true,opacity:.35,depthWrite:false,blending:T.AdditiveBlending,sizeAttenuation:true});
  this.dust=new T.Points(dg,dm);this.dust.name='Atmosphere dust';scene.add(this.dust);
  this.disposables.push(bg,tex,tableGeo,tableMat,dg,dm,this.env);

  this.composer=new EffectComposer(renderer);this.composer.addPass(new RenderPass(scene,camera));
  this.gtao=new GTAOPass(scene,camera,1,1);this.gtao.updateGtaoMaterial({radius:.55,distanceExponent:1.4,thickness:1.2,scale:1.1,samples:12});this.gtao.blendIntensity=.85;this.composer.addPass(this.gtao);
  this.tiltH=new ShaderPass(HorizontalTiltShiftShader);this.tiltV=new ShaderPass(VerticalTiltShiftShader);this.composer.addPass(this.tiltH);this.composer.addPass(this.tiltV);
  this.bloom=new UnrealBloomPass(new T.Vector2(1,1),.14,.5,.97);this.composer.addPass(this.bloom);
  this.composer.addPass(new OutputPass());
  this.finish=new ShaderPass(Finish);this.composer.addPass(this.finish);
 }
 setSize(w:number,h:number){this.composer.setPixelRatio(this.renderer.getPixelRatio());this.composer.setSize(w,h);this.tiltH.uniforms.h.value=1/(w||1);this.tiltV.uniforms.v.value=1/(h||1);}
 /** 0 high: everything · 1 balanced: no GTAO · 2 economy: tilt-shift only, no dust · 3 minimal: plain render. */
 setLevel(level:number){this.level=Math.max(0,Math.min(3,level)) as AtmosphereLevel;this.gtao.enabled=this.level===0;this.bloom.enabled=this.level<=1;this.dust.visible=this.level<=1;this.tiltH.enabled=this.tiltV.enabled=this.level<=2;this.finish.enabled=this.level<=2;}
 render(dt:number,reduced:boolean){
  if(!reduced)this.time+=dt;
  // Focus band follows the orbit target on screen; blur widens as the camera pulls back (miniature look).
  const p=this.target.clone().project(this.camera);this.focusY=T.MathUtils.lerp(this.focusY,T.MathUtils.clamp(p.y*.5+.5,.15,.85),Math.min(1,dt*6)||1);
  this.tiltH.uniforms.r.value=this.focusY;this.tiltV.uniforms.r.value=this.focusY;
  const far=T.MathUtils.smoothstep(this.camera.position.distanceTo(this.target),10,55);
  const w=this.renderer.domElement.width,h=this.renderer.domElement.height;
  const blur=2.6*far;this.tiltH.uniforms.h.value=blur/(w||1);this.tiltV.uniforms.v.value=blur/(h||1);const on=blur>.05&&this.level<=2;this.tiltH.enabled=this.tiltV.enabled=on;
  this.finish.uniforms.time.value=this.time;
  if(!reduced&&this.dust.visible){const a=this.dust.geometry.attributes.position as T.BufferAttribute,arr=a.array as Float32Array;for(let i=0;i<arr.length;i+=3){const k=i*.37;arr[i]=this.dustBase[i]+Math.sin(this.time*.11+k)*1.3;arr[i+1]=this.dustBase[i+1]+Math.sin(this.time*.07+k*1.7)*.6;arr[i+2]=this.dustBase[i+2]+Math.cos(this.time*.09+k)*1.1;}a.needsUpdate=true;}
  if(this.level===3){this.renderer.render(this.scene,this.camera);return;}
  this.composer.render(dt);
 }
 dispose(){for(const pass of this.composer.passes)pass.dispose();this.composer.dispose();this.table.removeFromParent();this.dust.removeFromParent();this.disposables.forEach(d=>d.dispose());this.scene.environment=null;this.scene.background=null;}
}
