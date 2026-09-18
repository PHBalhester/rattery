import * as T from 'three';
import {courtyardAreas,socialDens} from '../sim/courtyard';
import {CONFIG} from '../config';
export function addCourtyard(scene:T.Scene){
 const group=new T.Group();group.name='Social courtyard';scene.add(group);
 const point=(x:number,y:number,h:number)=>new T.Vector3((x-CONFIG.colony.burrowWidth/2)/30,h,(y-CONFIG.colony.burrowHeight/2)/30);
 const bedding=new T.MeshStandardMaterial({color:'#b19a6c',roughness:1}),wood=new T.MeshStandardMaterial({color:'#715237',roughness:.92}),roof=new T.MeshStandardMaterial({color:'#9c784b',roughness:1,side:T.DoubleSide,transparent:true,opacity:.72,depthWrite:false});
 courtyardAreas.forEach((c,i)=>{const floor=new T.Mesh(new T.CylinderGeometry(c.r/30,c.r/30,.06,64),bedding);floor.position.copy(point(c.x,c.y,-.13-i*.0002));floor.receiveShadow=true;group.add(floor);});
 // Only the exterior outline is drawn; overlapping floor lobes have no internal walls.
 const outline:number[]=[];for(const c of courtyardAreas)for(let i=0;i<100;i++){const a=i*Math.PI*2/100,b=(i+1)*Math.PI*2/100,mid={x:c.x+Math.cos((a+b)/2)*c.r,y:c.y+Math.sin((a+b)/2)*c.r};if(courtyardAreas.some(d=>d!==c&&Math.hypot(mid.x-d.x,mid.y-d.y)<d.r))continue;for(const t of[a,b])outline.push(...point(c.x+Math.cos(t)*c.r,c.y+Math.sin(t)*c.r,-.095).toArray());}
 const edge=new T.BufferGeometry();edge.setAttribute('position',new T.Float32BufferAttribute(outline,3));group.add(new T.LineSegments(edge,new T.LineBasicMaterial({color:'#6f553b'})));
 for(const d of socialDens){const centre=point(d.x,d.y,0);
  const bed=new T.Mesh(new T.CylinderGeometry(2.25,2.25,.035,48),new T.MeshStandardMaterial({color:'#c2aa7c',roughness:1}));bed.position.copy(centre);bed.position.y=-.075;bed.receiveShadow=true;group.add(bed);
  for(const sign of[-1,1]){const sill=new T.Mesh(new T.BoxGeometry(8/30,.3,130/30),wood);sill.position.copy(centre).add(new T.Vector3(sign*70/30,.05,0));sill.castShadow=true;group.add(sill);}
  const positions:number[]=[],indices:number[]=[];for(let i=0;i<=32;i++){const a=i*Math.PI/32;for(const z of[-65/30,65/30])positions.push(Math.cos(a)*70/30,Math.sin(a)*1.6-.1,z);}for(let i=0;i<32;i++){const a=i*2;indices.push(a,a+1,a+2,a+1,a+3,a+2);}const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(positions,3));geo.setIndex(indices);geo.computeVertexNormals();const cover=new T.Mesh(geo,roof);cover.position.copy(centre);group.add(cover);
  for(const z of[-65/30,65/30]){const pts=Array.from({length:33},(_,i)=>new T.Vector3(Math.cos(i*Math.PI/32)*70/30,Math.sin(i*Math.PI/32)*1.6-.1,z));const arch=new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(pts),32,.06,6,false),wood);arch.position.copy(centre);group.add(arch);}
 }
 return ()=>{const geometries=new Set<T.BufferGeometry>(),materials=new Set<T.Material>();group.traverse(o=>{if(o instanceof T.Mesh||o instanceof T.LineSegments){geometries.add(o.geometry);(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>materials.add(m))}});geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());group.removeFromParent();};
}
