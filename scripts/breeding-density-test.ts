import assert from 'node:assert/strict';
import {createWorld,tryConceive} from '../src/sim/colony';
function colony(n:number){const w=createWorld(),base=Object.values(w.rats)[0];w.rats={};for(let i=0;i<n;i++){const r=structuredClone(base);r.id='R'+i;r.sex=i%2?'M':'F';r.pregnant=null;w.rats[r.id]=r;}return w;}
for(const n of [90,110]){const w=colony(n),before=JSON.stringify(w);assert.equal(tryConceive(w,()=>0,w.rats.R0,w.rats.R1,1,w.env),false);assert.equal(JSON.stringify(w),before);}
const w=colony(70);assert.equal(tryConceive(w,()=>0,w.rats.R0,w.rats.R1,1,w.env),true);assert.equal(tryConceive(w,()=>0,w.rats.R2,w.rats.R1,1,w.env),false);
const low=colony(4);assert.equal(tryConceive(low,()=>0.7,low.rats.R0,low.rats.R1,1,low.env),true);
const high=colony(70);assert.equal(tryConceive(high,()=>0.3,high.rats.R0,high.rats.R1,1,high.env),false);
console.log('PASS density reduction, pregnancy reservations, preserved full colonies, reproduction at low density');
