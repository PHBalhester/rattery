import * as T from 'three';
import {rnd} from './craft';

/** One pooled particle system for dust, straw, sparkles and fireworks. Hard budget, one draw call. */
export class Particles{
 readonly points:T.Points<T.BufferGeometry,T.ShaderMaterial>;
 private pos:Float32Array;private vel:Float32Array;private col:Float32Array;private life:Float32Array;private max:Float32Array;private size:Float32Array;private drag:Float32Array;private grav:Float32Array;
 private cursor=0;budget:number;
 constructor(readonly capacity:number){
  this.budget=capacity;
  this.pos=new Float32Array(capacity*3);this.vel=new Float32Array(capacity*3);this.col=new Float32Array(capacity*3);
  this.life=new Float32Array(capacity);this.max=new Float32Array(capacity).fill(1);this.size=new Float32Array(capacity);this.drag=new Float32Array(capacity);this.grav=new Float32Array(capacity);
  const g=new T.BufferGeometry();
  g.setAttribute('position',new T.BufferAttribute(this.pos,3).setUsage(T.DynamicDrawUsage));
  g.setAttribute('color',new T.BufferAttribute(this.col,3).setUsage(T.DynamicDrawUsage));
  g.setAttribute('size',new T.BufferAttribute(this.size,1).setUsage(T.DynamicDrawUsage));
  g.setAttribute('alpha',new T.BufferAttribute(new Float32Array(capacity),1).setUsage(T.DynamicDrawUsage));
  const m=new T.ShaderMaterial({transparent:true,depthWrite:false,blending:T.AdditiveBlending,
   uniforms:{scale:{value:300}},
   vertexShader:`attribute float size;attribute float alpha;attribute vec3 color;varying vec3 vC;varying float vA;uniform float scale;
    void main(){vC=color;vA=alpha;vec4 mv=modelViewMatrix*vec4(position,1.);gl_PointSize=size*scale/-mv.z;gl_Position=projectionMatrix*mv;}`,
   fragmentShader:`varying vec3 vC;varying float vA;void main(){vec2 d=gl_PointCoord-.5;float r=length(d);if(r>.5)discard;float core=smoothstep(.5,0.,r);gl_FragColor=vec4(vC*(.6+core*.9),vA*core);}`});
  this.points=new T.Points(g,m);this.points.frustumCulled=false;this.points.renderOrder=5;
 }
 /** Spawns unless the quality budget is spent; oldest particles are recycled. */
 spawn(p:T.Vector3,v:T.Vector3,color:T.Color,life:number,size:number,drag=1.2,gravity=2){
  if(this.budget<=0)return;
  let i=-1;for(let k=0;k<this.budget;k++){const j=(this.cursor+k)%this.budget;if(this.life[j]<=0){i=j;break;}}
  if(i<0)i=this.cursor%this.budget;this.cursor=(i+1)%this.budget;
  this.pos.set([p.x,p.y,p.z],i*3);this.vel.set([v.x,v.y,v.z],i*3);this.col.set([color.r,color.g,color.b],i*3);
  this.life[i]=life;this.max[i]=life;this.size[i]=size;this.drag[i]=drag;this.grav[i]=gravity;
 }
 burst(center:T.Vector3,count:number,speed:number,color:T.Color,life:number,size:number,seed:number,opts:{up?:number;spread?:number;gravity?:number;drag?:number;white?:number}={}){
  const c=new T.Color();
  for(let i=0;i<count;i++){const u=rnd(seed+i)*2-1,th=rnd(seed+i*3+7)*Math.PI*2,r=Math.sqrt(1-u*u),sp=speed*(.55+rnd(seed+i*5)*.45);
   const v=new T.Vector3(Math.cos(th)*r,u*(opts.spread??1)+(opts.up??0),Math.sin(th)*r).multiplyScalar(sp);
   c.copy(color);if(opts.white&&rnd(seed+i*11)<opts.white)c.set('#fff6d8');
   this.spawn(center,v,c,life*(.75+rnd(seed+i*13)*.5),size*(.7+rnd(seed+i*17)*.6),opts.drag??1.2,opts.gravity??2);}
 }
 update(dt:number,time:number){
  const alpha=this.points.geometry.attributes.alpha as T.BufferAttribute;let alive=0;
  for(let i=0;i<this.capacity;i++){
   if(this.life[i]<=0){alpha.setX(i,0);continue;}
   if(i>=this.budget){this.life[i]=0;alpha.setX(i,0);continue;}
   this.life[i]-=dt;alive++;const k=Math.exp(-this.drag[i]*dt);
   this.vel[i*3]*=k;this.vel[i*3+1]=this.vel[i*3+1]*k-this.grav[i]*dt;this.vel[i*3+2]*=k;
   this.pos[i*3]+=this.vel[i*3]*dt;this.pos[i*3+1]+=this.vel[i*3+1]*dt;this.pos[i*3+2]+=this.vel[i*3+2]*dt;
   const f=Math.max(0,this.life[i]/this.max[i]),twinkle=.75+.25*Math.sin(time*23+i*1.7);
   alpha.setX(i,Math.min(1,f*1.6)*twinkle);
  }
  for(const name of ['position','color','size'])(this.points.geometry.attributes[name] as T.BufferAttribute).needsUpdate=true;alpha.needsUpdate=true;
  return alive;
 }
 clear(){this.life.fill(0);}
 dispose(){this.points.geometry.dispose();this.points.material.dispose();}
}

/** Floating "+20 / -40" numbers, drawn as billboards so they never hide behind the nest. */
export class FloatingText{
 private items:{sprite:T.Sprite;canvas:HTMLCanvasElement;map:T.CanvasTexture;age:number;dur:number;from:T.Vector3}[]=[];
 constructor(private parent:T.Object3D,count=6){
  for(let i=0;i<count;i++){const canvas=document.createElement('canvas');canvas.width=256;canvas.height=128;const map=new T.CanvasTexture(canvas);map.colorSpace=T.SRGBColorSpace;
   const sprite=new T.Sprite(new T.SpriteMaterial({map,transparent:true,depthTest:false}));sprite.visible=false;sprite.renderOrder=10;sprite.scale.set(1.6,.8,1);parent.add(sprite);
   this.items.push({sprite,canvas,map,age:0,dur:0,from:new T.Vector3()});}
 }
 show(text:string,color:string,at:T.Vector3){
  const item=this.items.find(i=>!i.sprite.visible)??this.items[0];const g=item.canvas.getContext('2d')!;g.clearRect(0,0,256,128);
  g.font='800 76px "Segoe UI",Arial,sans-serif';g.textAlign='center';g.textBaseline='middle';g.lineWidth=10;g.strokeStyle='rgba(12,12,8,.85)';g.strokeText(text,128,64);g.fillStyle=color;g.fillText(text,128,64);
  item.map.needsUpdate=true;item.from.copy(at);item.age=0;item.dur=1.6;item.sprite.visible=true;
 }
 update(dt:number){for(const i of this.items){if(!i.sprite.visible)continue;i.age+=dt;const t=i.age/i.dur;if(t>=1){i.sprite.visible=false;continue;}
  const pop=t<.15?T.MathUtils.lerp(.6,1.12,t/.15):t<.25?T.MathUtils.lerp(1.12,1,(t-.15)/.1):1;
  i.sprite.position.copy(i.from).add(new T.Vector3(0,1.4*(1-(1-t)**3),0));i.sprite.scale.set(1.6*pop,.8*pop,1);(i.sprite.material as T.SpriteMaterial).opacity=t<.7?1:1-(t-.7)/.3;}}
 dispose(){for(const i of this.items){i.map.dispose();i.sprite.material.dispose();i.sprite.removeFromParent();}}
}

/** Woven-light dome: fresnel rim, lattice, rising scan band and a dissolve. `progress` 0..1 raises it. */
export function shieldMaterial(color:string){
 return new T.ShaderMaterial({transparent:true,depthWrite:false,side:T.DoubleSide,blending:T.AdditiveBlending,
  uniforms:{color:{value:new T.Color(color)},time:{value:0},rise:{value:0},fade:{value:1},hit:{value:0},height:{value:4}},
  vertexShader:`varying vec3 vN;varying vec3 vW;varying vec3 vL;void main(){vL=position;vN=normalize(normalMatrix*normal);vec4 w=modelMatrix*vec4(position,1.);vW=w.xyz;gl_Position=projectionMatrix*viewMatrix*w;}`,
  fragmentShader:`uniform vec3 color;uniform float time,rise,fade,hit,height;varying vec3 vN;varying vec3 vW;varying vec3 vL;
   float h(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);}
   void main(){float y=vL.y/height;if(y>rise)discard;
    vec3 V=normalize(cameraPosition-vW);float fr=pow(1.-abs(dot(normalize(vN),V)),2.2);
    float ang=atan(vL.z,vL.x);float lat=fract(y*9.-time*.25),lon=fract(ang*18./6.2832+y*1.5);
    float weave=smoothstep(.9,1.,max(abs(lat-.5)*2.,abs(lon-.5)*2.));
    float edge=exp(-pow((y-rise)*18.,2.))*step(rise,.999);
    float scan=exp(-pow((y-fract(time*.45))*10.,2.))*.35;
    float grain=h(floor(vL.xz*14.)+floor(time*3.));float dissolve=step(grain,fade+.02);
    float a=(fr*.75+weave*.35+scan+edge*1.4+hit*.8)*dissolve*min(fade*2.,1.);
    gl_FragColor=vec4(mix(color,vec3(1.),edge*.6+hit*.4),a*.7);}`});
}
