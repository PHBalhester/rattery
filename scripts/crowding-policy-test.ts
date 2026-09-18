import assert from 'node:assert/strict';
import {createWorld,enforceCap} from '../src/sim/colony';
import {CONFIG} from '../src/config';
const w=createWorld(),base=Object.values(w.rats)[0];w.rats={};
for(let i=0;i<CONFIG.colony.maxAlive+3;i++){const r=structuredClone(base);r.id='R'+i;r.sex=i%2?'M':'F';r.bornAt=-100+i*.1;r.stage='adult';r.nursing=[];r.pregnant=null;w.rats[r.id]=r;}
w.rats.R0.nursing=['child'];w.rats.R1.stage='neonate';
w.care={owners:{R2:'0x'+'a'.repeat(40)},cooldowns:{},lastSequence:1,burned:500000};const care=structuredClone(w.care);
enforceCap(w);assert.equal(w.rats.R2?.deadAt??w.memorial?.R2.deadAt,w.simDay);assert.equal(w.totals.deaths,1);assert.equal(w.rats.R0.deadAt,null);assert.equal(w.rats.R1.deadAt,null);assert.deepEqual(w.care,care);
enforceCap(w);assert.equal(w.totals.deaths,1);
for(let i=0;i<5;i++){w.simDay+=1/3+.001;enforceCap(w);}assert.equal(w.totals.deaths,3);
const protectedWorld=createWorld();const template=Object.values(protectedWorld.rats)[0];protectedWorld.rats={};
for(let i=0;i<115;i++){const r=structuredClone(template);r.id='P'+i;r.stage=i<4?'adult':'neonate';r.sex=i%2?'M':'F';r.nursing=[];protectedWorld.rats[r.id]=r;}
enforceCap(protectedWorld);assert.equal(protectedWorld.totals.deaths,0);
console.log('PASS oldest eligible adult, gradual limit, stops at cap, mothers/pups and breeding minimum protected, minted history retained');
