import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

/** Reversible static batches. Original objects own materials; batches own only geometry. */
export class StaticNestBatch {
 private merged:T.Mesh[]=[];
 private originals:{mesh:T.Mesh;visible:boolean}[]=[];
 constructor(private root:T.Group,private sources:T.Object3D[]){}
 get active(){return this.merged.length>0;}
 get draws(){return this.merged.length;}
 get sourceDraws(){return this.originals.length;}
 merge(){
  if(this.active)return;
  this.root.updateWorldMatrix(true,true);
  const inverse=this.root.matrixWorld.clone().invert();
  const buckets=new Map<string,{material:T.Material;meshes:T.Mesh[]}>();
  for(const source of this.sources)source.traverseVisible(obj=>{
   if(!(obj instanceof T.Mesh)||obj instanceof T.SkinnedMesh||Array.isArray(obj.material))return;
   const key=[obj.material.uuid,obj.castShadow,obj.receiveShadow,obj.renderOrder,obj.layers.mask].join(':');
   let bucket=buckets.get(key);if(!bucket){bucket={material:obj.material,meshes:[]};buckets.set(key,bucket);}
   bucket.meshes.push(obj);
  });
  for(const {material,meshes} of buckets.values()){
   const transformed=meshes.map(mesh=>{
    const geometry=mesh.geometry.index?mesh.geometry.toNonIndexed():mesh.geometry.clone();
    for(const name of Object.keys(geometry.attributes))if(!['position','normal','uv','color'].includes(name))geometry.deleteAttribute(name);
    if(!geometry.getAttribute('normal'))geometry.computeVertexNormals();
    if(!geometry.getAttribute('uv'))geometry.setAttribute('uv',new T.Float32BufferAttribute(new Float32Array(geometry.getAttribute('position').count*2),2));
    if(!geometry.getAttribute('color'))geometry.setAttribute('color',new T.Float32BufferAttribute(new Float32Array(geometry.getAttribute('position').count*3).fill(1),3));
    geometry.applyMatrix4(new T.Matrix4().multiplyMatrices(inverse,mesh.matrixWorld));
    return geometry;
   });
   const geometry=mergeGeometries(transformed,false);transformed.forEach(g=>g.dispose());
   if(!geometry)continue;
   geometry.computeBoundingBox();geometry.computeBoundingSphere();
   const batch=new T.Mesh(geometry,material),first=meshes[0];
   batch.name='Settled nest material batch';batch.castShadow=first.castShadow;batch.receiveShadow=first.receiveShadow;batch.renderOrder=first.renderOrder;batch.layers.mask=first.layers.mask;
   this.root.add(batch);this.merged.push(batch);
   for(const mesh of meshes){this.originals.push({mesh,visible:mesh.visible});mesh.visible=false;}
  }
 }
 restore(){
  for(const {mesh,visible} of this.originals)mesh.visible=visible;
  this.originals=[];
  for(const mesh of this.merged){mesh.removeFromParent();mesh.geometry.dispose();}
  this.merged=[];
 }
 dispose(){this.restore();}
}

