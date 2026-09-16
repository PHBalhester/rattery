import { useEffect, useRef, useState } from 'react';
import * as T from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { BRAIN_NODES, BRAIN_EDGES } from '../sim/brain';

// Procedural illustration only. Particle locations are not measured anatomy.
export default function Brain3D({activity}:{activity:Record<string,number>}) {
 const host=useRef<HTMLDivElement>(null), values=useRef(activity);
 values.current=activity;
 const [failed,setFailed]=useState(false), [labels,setLabels]=useState(false), [effects,setEffects]=useState(true);
 const effectsOn=useRef(effects);effectsOn.current=effects;
 useEffect(()=>{
  const el=host.current!;
  let renderer:T.WebGLRenderer;
  try { renderer=new T.WebGLRenderer({antialias:true,alpha:true}); }
  catch { setFailed(true);return; }
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.75));
  el.prepend(renderer.domElement);
  const scene=new T.Scene(), camera=new T.PerspectiveCamera(38,1,.1,100);
  const controls=new OrbitControls(camera,renderer.domElement);
  controls.enablePan=false;controls.enableDamping=true;controls.dampingFactor=.07;
  controls.minDistance=6;controls.maxDistance=18;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const geometries:T.BufferGeometry[]=[], materials:T.Material[]=[];
  // Shared soft sprite for decorative sparks and signal trails.
  const pixels=new Uint8Array(32*32*4);
  for(let y=0;y<32;y++)for(let x=0;x<32;x++){
   const i=(y*32+x)*4,d=Math.hypot((x-15.5)/15.5,(y-15.5)/15.5);
   pixels[i]=pixels[i+1]=pixels[i+2]=255;pixels[i+3]=Math.round(255*Math.max(0,1-d)**3);
  }
  const glow=new T.DataTexture(pixels,32,32);glow.needsUpdate=true;
  glow.magFilter=T.LinearFilter;glow.minFilter=T.LinearFilter;
  const sparkCoords:number[]=[];
  const cloud=(coords:number[],color:T.ColorRepresentation,size:number,opacity:number)=>{
   const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(coords,3));
   const m=new T.PointsMaterial({color,size,transparent:true,opacity,depthWrite:false,blending:T.AdditiveBlending});
   geometries.push(g);materials.push(m);
   const p=new T.Points(g,m);scene.add(p);return p;
  };
  // Paired smooth hemispheres, small anterior bulbs and a posterior cerebellar fan.
  const shells=[
   {c:[-1.05,.2,0],s:[1.3,1.25,2.05],color:'#8978ce',n:6400},
   {c:[1.05,.2,0],s:[1.3,1.25,2.05],color:'#b365a0',n:6400},
   {c:[-.5,-.05,2],s:[.55,.6,.95],color:'#759cba',n:1600},
   {c:[.5,-.05,2],s:[.55,.6,.95],color:'#759cba',n:1600},
   {c:[0,-.35,-1.9],s:[1.35,.8,.85],color:'#58a395',n:2600}
  ];
  shells.forEach(({c,s,color,n},index)=>{
   const coords:number[]=[];
   for(let k=0;k<n;k++){
    const y=1-2*(k+.5)/n, r=Math.sqrt(1-y*y), a=k*2.399963;
    const depth=k%5===0?.68+.25*((k*37%101)/101):1;
    const ripple=index===4?1+.055*Math.cos(a*14):1+.025*Math.sin(a*5+y*9);
    coords.push(c[0]+Math.cos(a)*r*s[0]*depth*ripple,c[1]+y*s[1]*depth,c[2]+Math.sin(a)*r*s[2]*depth);
   }
   cloud(coords,color,.018,.42);
   for(let k=0;k<n;k+=23)sparkCoords.push(coords[k*3],coords[k*3+1],coords[k*3+2]);
  });
  const sparks=cloud(sparkCoords,'#c4b1ef',.095,.8);
  sparks.material.map=glow;
  const sparkColors=new Float32Array(sparkCoords.length);
  sparks.geometry.setAttribute('color',new T.BufferAttribute(sparkColors,3));
  sparks.material.vertexColors=true;
  const halos=BRAIN_NODES.map((n,i)=>{
   const p=cloud([0,0,0],n.color,.65,.2);p.material.map=glow;return {p,phase:i*.73};
  });
  const positions=BRAIN_NODES.map((n,i)=>new T.Vector3((n.x-.5)*3.6,(.45-n.y)*2.5,Math.sin(i*1.7)*1.25));
  halos.forEach(({p},i)=>p.position.copy(positions[i]));
  const regions=BRAIN_NODES.map((n,i)=>{
   const coords:number[]=[];
   for(let k=0;k<420;k++){
    const y=1-2*(k+.5)/420,r=Math.sqrt(1-y*y),a=k*2.399963,s=.19+.16*((k*31%97)/97);
    coords.push(Math.cos(a)*r*s,y*s,Math.sin(a)*r*s);
   }
   const p=cloud(coords,n.color,.028,.65);p.position.copy(positions[i]);return p;
  });
  const connections=BRAIN_EDGES.map(([a,b],index)=>{
   const start=positions[BRAIN_NODES.findIndex(n=>n.id===a)],end=positions[BRAIN_NODES.findIndex(n=>n.id===b)];
   const mid=start.clone().lerp(end,.5);mid.y+=.3;mid.z+=.35;
   const curve=new T.QuadraticBezierCurve3(start,mid,end),coords:number[]=[];
   for(let strand=0;strand<5;strand++){
    const offset=(strand-2)*.018;
    const samples=curve.getPoints(36);
    for(let k=0;k<36;k++) for(const p of [samples[k],samples[k+1]]) coords.push(p.x+offset,p.y+offset,p.z);
   }
   const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(coords,3));
   const mat=new T.LineBasicMaterial({color:index%2?'#c596bd':'#e4c783',transparent:true,opacity:.18,depthWrite:false,blending:T.AdditiveBlending});
   geometries.push(geo);materials.push(mat);scene.add(new T.LineSegments(geo,mat));
   const pulse=cloud(new Array(3*10*3).fill(0),'#ffe5ad',.12,.9);
   pulse.material.map=glow;pulse.material.vertexColors=true;
   const colors:number[]=[];
   for(let k=0;k<3;k++)for(let t=0;t<10;t++){
    const fade=(1-t/10)**2;colors.push(fade,fade,fade);
   }
   pulse.geometry.setAttribute('color',new T.Float32BufferAttribute(colors,3));
   return {a,b,curve,mat,pulse};
  });
  const domLabels=Array.from(el.querySelectorAll<HTMLSpanElement>('.brain-label-3d'));
  const projected=new T.Vector3(),point=new T.Vector3();
  const resize=()=>{
   if(!el.clientWidth||!el.clientHeight)return;
   camera.aspect=el.clientWidth/el.clientHeight;
   camera.updateProjectionMatrix();
   renderer.setSize(el.clientWidth,el.clientHeight);
  };
  const reset=()=>{
   const distance=Math.max(8.7,8.4/Math.max(.6,el.clientWidth/el.clientHeight));
   camera.position.set(distance*.5,distance*.5,distance*.707);
   controls.target.set(0,0,0);controls.update();
  };
  const resetButton=el.querySelector<HTMLButtonElement>('[data-brain-reset]')!;
  resetButton.addEventListener('click',reset);
  const observer=new ResizeObserver(resize);observer.observe(el);resize();reset();
  const lost=(event:Event)=>{event.preventDefault();renderer.setAnimationLoop(null);setFailed(true);};
  renderer.domElement.addEventListener('webglcontextlost',lost);
  renderer.setAnimationLoop(time=>{
   controls.enableDamping=!reduced.matches;
   controls.update();
   // Cosmetic time is separate from simulation time and never writes to the model.
   const animate=effectsOn.current&&!reduced.matches, seconds=animate?time*.001:0;
   sparks.visible=effectsOn.current;
   for(let i=0;i<sparkColors.length/3;i++){
    const wave=animate?Math.max(0,Math.sin(seconds*.85+i*2.39996))**18:.07;
    sparkColors[i*3]=wave;sparkColors[i*3+1]=wave*(.65+.3*Math.sin(i));sparkColors[i*3+2]=wave*.85;
   }
   sparks.geometry.getAttribute('color').needsUpdate=true;
   halos.forEach(({p,phase})=>{
    p.visible=effectsOn.current;
    const breath=animate?.5+.5*Math.sin(seconds*1.2+phase):.25;
    p.material.opacity=.1+breath*.35;p.material.size=.5+breath*.35;
   });
   regions.forEach((p,i)=>{
    const a=T.MathUtils.clamp(values.current[BRAIN_NODES[i].id]??0,0,1);
    p.material.opacity=reduced.matches?.3+a*.65:T.MathUtils.lerp(p.material.opacity,.3+a*.65,.08);
    p.material.size=.025+a*.024;
    projected.copy(positions[i]).project(camera);
    const label=domLabels[i];
    if(label){label.style.left=`${(projected.x*.5+.5)*100}%`;label.style.top=`${(-projected.y*.5+.5)*100}%`;}
   });
   connections.forEach(({a,b,curve,mat,pulse},i)=>{
    const level=T.MathUtils.clamp(((values.current[a]??0)+(values.current[b]??0))/2,0,1);
    mat.opacity=.08+level*.25+(animate?.06*(.5+.5*Math.sin(seconds*1.2+i)):0);
    pulse.visible=effectsOn.current;
    const attr=pulse.geometry.getAttribute('position') as T.BufferAttribute;
    for(let k=0;k<3;k++)for(let tail=0;tail<10;tail++){
     const head=animate?(seconds*.14+i*.137+k/3)%1:(k+1)/4;
     curve.getPoint(Math.max(0,head-tail*.008),point);
     attr.setXYZ(k*10+tail,point.x,point.y,point.z);
    }
    attr.needsUpdate=true;pulse.material.opacity=.7;
   });
   renderer.render(scene,camera);
  });
  return()=>{
   observer.disconnect();renderer.setAnimationLoop(null);controls.dispose();
   resetButton.removeEventListener('click',reset);
   renderer.domElement.removeEventListener('webglcontextlost',lost);
   geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());
   glow.dispose();
   renderer.dispose();renderer.domElement.remove();
  };
 },[]);
 return <div className={`brain-3d ${labels?'show-labels':''}`} ref={host}>
  <div className="brain-view-tools"><span>NEURAL PORTRAIT</span><button onClick={()=>setEffects(v=>!v)} aria-pressed={effects}>FX</button><button onClick={()=>setLabels(v=>!v)} aria-pressed={labels}>Regions</button><button data-brain-reset>Reset view</button></div>
  {failed?<div className="brain-fallback">3D unavailable. Individual model readings remain below.</div>:BRAIN_NODES.map(n=><span className="brain-label-3d" key={n.id}>{n.id}</span>)}
  <span className="brain-3d-hint">Cosmetic pulses · drag to orbit · scroll to zoom</span>
 </div>;
}

