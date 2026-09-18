import assert from 'node:assert/strict';
import {AdaptiveQuality,qualityProfiles} from '../src/render/AdaptiveQuality';
const q=new AdaptiveQuality();
for(let i=0;i<300;i++)q.sample(1000/60);assert.equal(q.level,0);
for(let i=0;i<200;i++)q.sample(100);assert.equal(q.level,3,'sustained low FPS reduces cost');
for(let i=0;i<600;i++)q.sample(1000/60);assert.equal(q.level,3,'short fast interval cannot oscillate quality');
for(let i=0;i<2000;i++)q.sample(1000/60);assert.equal(q.level,2,'sustained recovery raises one level');
const before=q.level;q.resetWindow();q.sample(3000);assert.equal(q.level,before,'tab return spike ignored');
for(const n of [NaN,Infinity,-1,0])assert.equal(q.sample(n),false);
assert(qualityProfiles.every((p,i)=>i===0||p.pixelRatio<=qualityProfiles[i-1].pixelRatio));
console.log('PASS: low-FPS fallback, delayed recovery, tab-return protection, invalid samples and bounded render profiles');

const borderline=new AdaptiveQuality();for(let i=0;i<300;i++)borderline.sample(35);assert(borderline.level>0,"quality must react before sustained FPS falls below 30");
