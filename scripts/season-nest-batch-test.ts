import assert from 'node:assert/strict';
import * as T from 'three';
import {StaticNestBatch} from '../src/render/season/StaticNestBatch';
const root=new T.Group();root.position.set(7,2,-4);root.rotation.y=.7;root.scale.setScalar(1.2);
const parent=new T.Group();parent.position.set(2,1,3);root.add(parent);
const mat=new T.MeshStandardMaterial();
const a=new T.Mesh(new T.BoxGeometry(),mat),b=new T.Mesh(new T.SphereGeometry(1,8,6),mat);
a.geometry.setAttribute('color',new T.Float32BufferAttribute(new Float32Array(a.geometry.getAttribute('position').count*3).fill(.4),3));
a.position.x=3;b.position.z=-2;parent.add(a,b);
const hidden=new T.Mesh(new T.BoxGeometry(),mat);hidden.visible=false;parent.add(hidden);
const light=new T.PointLight();parent.add(light);
root.updateWorldMatrix(true,true);
const expected=new T.Box3().setFromObject(a,true).union(new T.Box3().setFromObject(b,true));
const batch=new StaticNestBatch(root,[parent]);
let disposed=0;mat.addEventListener('dispose',()=>disposed++);
for(let i=0;i<4;i++){
 batch.merge();assert.equal(batch.draws,1);assert.equal(batch.sourceDraws,2);
 assert(!a.visible&&!b.visible&&!hidden.visible&&light.visible);
 const merged=root.children.find(o=>o.name==='Settled nest material batch')!;
 const colors=(merged as T.Mesh).geometry.getAttribute('color');assert(Math.abs(colors.getX(0)-.4)<1e-6);assert.equal(colors.getX(colors.count-1),1);
 const actual=new T.Box3().setFromObject(merged,true);
 assert(actual.min.distanceTo(expected.min)<1e-5&&actual.max.distanceTo(expected.max)<1e-5);
 batch.merge();assert.equal(batch.draws,1);
 batch.restore();assert(a.visible&&b.visible&&!hidden.visible&&light.visible);assert.equal(batch.draws,0);
}
batch.merge();batch.dispose();assert.equal(disposed,0);assert.equal(root.children.length,1);
console.log('PASS static batching: transformed bounds, shared material, hidden geometry, light, idempotence, restoration and disposal');

