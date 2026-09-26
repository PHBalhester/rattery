import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

/**
 * Procedural "rat-built" construction kit for the Season nests. Every geometry here is generated
 * deterministically (no random state), so two viewers see the same nests.
 */
export const rnd=(i:number)=>{const v=Math.sin(i*127.1+311.7)*43758.5453;return v-Math.floor(v);};

export type Kit={
 straw:T.MeshStandardMaterial;strawDark:T.MeshStandardMaterial;twig:T.MeshStandardMaterial;plank:T.MeshStandardMaterial;
 earth:T.MeshStandardMaterial;brass:T.MeshStandardMaterial;rope:T.MeshStandardMaterial;paper:T.MeshStandardMaterial;
 seed:T.MeshStandardMaterial;cheese:T.MeshStandardMaterial;red:T.MeshStandardMaterial;leaf:T.MeshStandardMaterial;
 lantern:T.MeshStandardMaterial;dispose():void;
};

/** Cheap world-space grain so flat colours read as fibre, wood and earth. */
function grain(m:T.MeshStandardMaterial,scale:number,amount:number,key:string){
 m.onBeforeCompile=shader=>{
  shader.uniforms.gScale={value:scale};shader.uniforms.gAmount={value:amount};
  shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vGP;').replace('#include <worldpos_vertex>','#include <worldpos_vertex>\nvGP=(modelMatrix*vec4(transformed,1.)).xyz;');
  shader.fragmentShader=shader.fragmentShader.replace('#include <common>',`#include <common>
   varying vec3 vGP;uniform float gScale,gAmount;
   float gh(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}
   float gn(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(mix(gh(i),gh(i+vec3(1,0,0)),f.x),mix(gh(i+vec3(0,1,0)),gh(i+vec3(1,1,0)),f.x),f.y),mix(mix(gh(i+vec3(0,0,1)),gh(i+vec3(1,0,1)),f.x),mix(gh(i+vec3(0,1,1)),gh(i+vec3(1,1,1)),f.x),f.y),f.z);}`)
   .replace('#include <color_fragment>',`#include <color_fragment>
   vec3 gq=vGP*gScale;float gv=gn(gq)*.6+gn(gq*vec3(1.,6.,1.)*2.3)*.4;diffuseColor.rgb*=1.+(gv-.5)*2.*gAmount;`);
 };
 m.customProgramCacheKey=()=>'season-grain-'+key;
 return m;
}

export function makeKit():Kit{
 const std=(o:T.MeshStandardMaterialParameters)=>new T.MeshStandardMaterial(o);
 const k={
  straw:grain(std({color:'#d2b06a',roughness:1,vertexColors:true}),5,.22,'straw'),
  strawDark:grain(std({color:'#a8834a',roughness:1}),6,.2,'strawdark'),
  twig:grain(std({color:'#6f4b2e',roughness:.95}),3,.25,'twig'),
  plank:grain(std({color:'#a8794c',roughness:.82}),2.2,.2,'plank'),
  earth:grain(std({color:'#6d5236',roughness:1}),1.4,.24,'earth'),
  brass:std({color:'#d2a454',metalness:.75,roughness:.32}),
  rope:grain(std({color:'#c4a577',roughness:1}),14,.25,'rope'),
  paper:grain(std({color:'#b98b58',roughness:.9}),3,.12,'paper'),
  seed:std({color:'#e5c98f',roughness:.7}),
  cheese:std({color:'#f2c14e',roughness:.55}),
  red:std({color:'#c8392f',roughness:.45}),
  leaf:std({color:'#6f9d3a',roughness:.7}),
  lantern:std({color:'#ffd58a',emissive:'#ffb347',emissiveIntensity:1.6,roughness:.4}),
 };
 return {...k,dispose(){Object.values(k).forEach(m=>m.dispose());}};
}

/** Tube through points with a per-strand vertex colour, ready for merging. */
function strand(points:T.Vector3[],radius:number,tint:number,closed=false,segments?:number){
 const g=new T.TubeGeometry(new T.CatmullRomCurve3(points,closed),segments??Math.max(8,points.length*3),radius,5,closed);
 const n=g.attributes.position.count,c=new Float32Array(n*3),col=new T.Color(.78+tint*.22,.74+tint*.2,.62+tint*.26);
 for(let i=0;i<n;i++)c.set([col.r,col.g,col.b],i*3);g.setAttribute('color',new T.BufferAttribute(c,3));return g;
}

/**
 * Basket weave: horizontal wefts passing over and under vertical stakes. `gap` leaves an entrance
 * centred on +z. Rows are returned separately so the wall can be built course by course.
 */
export function wovenCourses(radius:number,rows:number,rowHeight:number,y0:number,gapHalf:number,seed:number,stakes=22){
 const courses:T.BufferGeometry[]=[];const start=Math.PI/2+gapHalf,end=Math.PI/2+Math.PI*2-gapHalf;
 for(let r=0;r<rows;r++){
  const pts:T.Vector3[]=[];const steps=64;
  for(let i=0;i<=steps;i++){const a=start+(end-start)*i/steps,phase=a*stakes/2+r*Math.PI,rr=radius*(1-.02*r)+Math.cos(phase)*.05;
   pts.push(new T.Vector3(Math.cos(a)*rr,y0+r*rowHeight+Math.sin(phase)*.015,Math.sin(a)*rr));}
  const parts=[strand(pts,.07,rnd(seed+r)),strand(pts.map(p=>p.clone().add(new T.Vector3(0,rowHeight*.5,0))),.06,rnd(seed+r+50))];
  // Packed fibre band behind the wefts so the wall is solid (built course by course with them).
  const band=new T.CylinderGeometry(radius*(1-.02*r)-.05,radius*(1-.02*r)-.04,rowHeight*1.02,48,1,true,gapHalf,Math.PI*2-gapHalf*2);band.translate(0,y0+r*rowHeight+rowHeight*.25,0);
  const n=band.attributes.position.count,c=new Float32Array(n*3);for(let i=0;i<n;i++)c.set([.8+rnd(seed+r)*.08,.7,.52],i*3);band.setAttribute('color',new T.BufferAttribute(c,3));
  const all=[band,...parts].map(g=>{const q=g.index?g.toNonIndexed():g;q.deleteAttribute('uv');return q;});
  courses.push(mergeGeometries(all)!);parts.forEach(p=>p.dispose());band.dispose();
 }
 return courses;
}
export function wovenStakes(radius:number,height:number,y0:number,gapHalf:number,count=22){
 const parts:T.BufferGeometry[]=[];
 for(let i=0;i<count;i++){const a=Math.PI/2+gapHalf+(Math.PI*2-gapHalf*2)*i/(count-1);
  const g=new T.CylinderGeometry(.035,.05,height,5);g.translate(0,y0+height/2,0);g.rotateZ((rnd(i+9)-.5)*.08);g.translate(Math.cos(a)*radius,0,Math.sin(a)*radius);parts.push(g);}
 const m=mergeGeometries(parts)!;parts.forEach(p=>p.dispose());return m;
}

/** One dome rib: smooth arc, or `facets` straight segments for an angular (NVIDIA) silhouette. */
export function rib(radius:number,height:number,angle:number,y0:number,facets=0,thick=.07){
 const pts:T.Vector3[]=[];const n=facets||16;
 for(let i=0;i<=n;i++){const t=i/n*Math.PI,r=Math.cos(t)*radius;pts.push(new T.Vector3(Math.cos(angle)*r,y0+Math.sin(t)*height,Math.sin(angle)*r));}
 const curve=facets?new T.CurvePath<T.Vector3>():new T.CatmullRomCurve3(pts);
 if(facets)for(let i=0;i<n;i++)(curve as T.CurvePath<T.Vector3>).add(new T.LineCurve3(pts[i],pts[i+1]));
 return new T.TubeGeometry(curve as T.Curve<T.Vector3>,facets?facets*6:40,thick,6,false);
}

/** Thatch panel: overlapping straw bundles laid over a spherical cap sector (lat bands). */
export function thatch(radius:number,height:number,y0:number,aFrom:number,aTo:number,band:number,bands:number,seed:number){
 const parts:T.BufferGeometry[]=[];
 const lat0=band/bands,lat1=(band+1)/bands;
 for(let k=0;k<22;k++){
  const t=lat0+(lat1-lat0)*((k%3)/3+.17),pts:T.Vector3[]=[];
  for(let i=0;i<=24;i++){const a=aFrom+(aTo-aFrom)*i/24,phi=t*Math.PI/2,r=Math.cos(phi)*radius*(1.02+.02*rnd(seed+k)),y=y0+Math.sin(phi)*height+(rnd(seed+k*7+i)-.5)*.03;
   pts.push(new T.Vector3(Math.cos(a)*r,y,Math.sin(a)*r));}
  parts.push(strand(pts,.06-.02*t,rnd(seed+k*3)*.8));
 }
 // Packed straw shell beneath the bundles, so the roof reads as thatch rather than a wire cage.
 const th0=Math.PI/2-lat1*Math.PI/2,th1=Math.PI/2-lat0*Math.PI/2;
 const shell=new T.SphereGeometry(radius*.985,40,3,aFrom,aTo-aFrom,th0,th1-th0);shell.scale(1,height/radius,1);shell.translate(0,y0,0);
 const n=shell.attributes.position.count,c=new Float32Array(n*3);for(let i=0;i<n;i++)c.set([.72,.64,.5],i*3);shell.setAttribute('color',new T.BufferAttribute(c,3));
 const clean=shell.index?shell.toNonIndexed():shell;const tubes=parts.map(p=>p.index?p.toNonIndexed():p);
 for(const g of [clean,...tubes])g.deleteAttribute('uv');
 const m=mergeGeometries([clean,...tubes])!;parts.forEach(p=>p.dispose());shell.dispose();return m;
}

/** Loose bedding strands scattered on the floor, one instanced draw. */
export function bedding(material:T.Material,count:number,radius:number,y:number,seed:number){
 const geo=new T.CylinderGeometry(.018,.018,.55,4);geo.rotateZ(Math.PI/2);
 const mesh=new T.InstancedMesh(geo,material,count),o=new T.Object3D();
 for(let i=0;i<count;i++){const a=rnd(seed+i)*Math.PI*2,r=Math.sqrt(rnd(seed+i*3+1))*radius;
  o.position.set(Math.cos(a)*r,y+rnd(seed+i*5)*.05,Math.sin(a)*r);o.rotation.set((rnd(i+2)-.5)*.4,rnd(seed+i*7)*Math.PI,(rnd(i+4)-.5)*.3);o.scale.set(.6+rnd(i+11)*.8,1,1);o.updateMatrix();mesh.setMatrixAt(i,o.matrix);}
 mesh.receiveShadow=true;return mesh;
}

/** Soft cloth texture with a real weave and stitched hem; `motif` gives each company its own fabric. */
export function fabricTexture(color:string,motif:'grid'|'linen'|'stripe'){
 const c=document.createElement('canvas');c.width=c.height=256;const g=c.getContext('2d')!;
 g.fillStyle=color;g.fillRect(0,0,256,256);
 for(let y=0;y<256;y+=2){g.fillStyle=`rgba(0,0,0,${.04+(y%4?0:.03)})`;g.fillRect(0,y,256,1);}
 for(let x=0;x<256;x+=2){g.fillStyle=`rgba(255,255,255,${x%4?.025:.05})`;g.fillRect(x,0,1,256);}
 if(motif==='grid'){g.strokeStyle='rgba(10,30,5,.35)';g.lineWidth=2;for(let i=0;i<=256;i+=32){g.beginPath();g.moveTo(i,0);g.lineTo(i,256);g.stroke();g.beginPath();g.moveTo(0,i);g.lineTo(256,i);g.stroke();}}
 if(motif==='stripe'){g.fillStyle='rgba(90,40,0,.28)';for(let i=0;i<256;i+=48)g.fillRect(0,i,256,14);}
 if(motif==='linen'){for(let i=0;i<900;i++){g.fillStyle=`rgba(255,255,255,${rnd(i)*.08})`;g.fillRect(rnd(i+1)*256,rnd(i+2)*256,rnd(i+3)*6,1);}}
 g.setLineDash([6,5]);g.strokeStyle='rgba(255,255,255,.55)';g.lineWidth=2;g.strokeRect(8,8,240,240);
 const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;t.wrapS=t.wrapT=T.RepeatWrapping;t.anisotropy=4;return t;
}

/**
 * Flag artwork: company name set in our own type, ticker and a stitched border. A licensed logo placed at
 * /season/flags/<TICKER>.png is drawn instead of the wordmark when present (no logo artwork ships here).
 */
export function flagCanvas(company:string,ticker:string,color:string,ink:string){
 const c=document.createElement('canvas');c.width=1024;c.height=600;
 const draw=(logo?:HTMLImageElement)=>{const g=c.getContext('2d')!;
  const grad=g.createLinearGradient(0,0,0,600);grad.addColorStop(0,color);grad.addColorStop(1,shade(color,-.18));g.fillStyle=grad;g.fillRect(0,0,1024,600);
  for(let y=0;y<600;y+=3){g.fillStyle=`rgba(0,0,0,${y%6?.035:.06})`;g.fillRect(0,y,1024,1);}
  g.fillStyle='rgba(0,0,0,.18)';g.fillRect(0,0,70,600);
  g.setLineDash([14,10]);g.strokeStyle='rgba(255,255,255,.6)';g.lineWidth=5;g.strokeRect(96,28,900,544);g.setLineDash([]);
  g.fillStyle=ink;g.textAlign='center';g.textBaseline='middle';
  if(logo){const s=Math.min(560/logo.width,300/logo.height);g.drawImage(logo,560-logo.width*s/2,250-logo.height*s/2,logo.width*s,logo.height*s);}
  else{let size=190;g.font=`800 ${size}px "Segoe UI",Arial,sans-serif`;while(g.measureText(company).width>820&&size>60){size-=8;g.font=`800 ${size}px "Segoe UI",Arial,sans-serif`;}g.fillText(company,545,250);}
  g.font='700 58px "IBM Plex Mono",monospace';g.globalAlpha=.8;g.fillText(`${ticker} · NEST`,545,455);g.globalAlpha=1;
 };
 draw();return {canvas:c,withLogo:(onReady:()=>void)=>{const img=new Image();img.onload=()=>{draw(img);onReady();};img.onerror=()=>{};img.src=`/season/flags/${ticker}.png`;}};
}
export function shade(hex:string,amount:number){const c=new T.Color(hex);const hsl={h:0,s:0,l:0};c.getHSL(hsl);c.setHSL(hsl.h,hsl.s,T.MathUtils.clamp(hsl.l+amount,0,1));return '#'+c.getHexString();}
