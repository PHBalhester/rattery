import assert from 'node:assert/strict';
import {createWorld,NEST_POS} from '../src/sim/colony';
import {tick} from '../src/sim/tick';
import {worldRng} from '../src/sim/rng';
import {applyTrade} from '../src/sim/marketMap';
import {zones} from '../src/sim/ecology';
import type {World,Trade} from '../src/types';
import {writeFileSync,mkdirSync} from 'node:fs';
const names=['hunger','dehydration','cold','heat','panic','isolation','crowded','distributed','injuries','pregnancy','lactation','aging','extinction','buy-burst','sell-burst','alternating','recovery'];
const results:any[]=[];
for(const name of names)for(const seed of [1,9,42]){
 let w=createWorld(seed);let rs=Object.values(w.rats);
 if(name==='crowded'||name==='distributed'){for(let i=4;i<80;i++){const r=JSON.parse(JSON.stringify(rs[i%4]));r.id=`stress-${i}`;w.rats[r.id]=r;}rs=Object.values(w.rats);rs.forEach((r,i)=>{const p=zones[name==='crowded'?0:i%zones.length];r.x=p.x;r.y=p.y;});}
 if(name==='isolation'){for(const r of rs.slice(1))delete w.rats[r.id];rs=Object.values(w.rats);}
 if(name==='extinction'){w.rats={};rs=[];}
 if(name==='injuries')rs.forEach(r=>r.injury=.6);
 if(name==='aging')rs.forEach(r=>r.bornAt=-401);
 if(name==='pregnancy'){const f=rs.find(r=>r.sex==='F')!,m=rs.find(r=>r.sex==='M')!;f.pregnant={sireId:m.id,sireGenome:{...m.genome},conceivedAt:-22,dueAt:.05,plannedLitter:14,conceivedStressed:true,conceivedFlush:false};}
 if(name==='lactation'){const f=rs.find(r=>r.sex==='F')!,template=rs[0];for(let i=0;i<12;i++){const p=JSON.parse(JSON.stringify(template));Object.assign(p,{id:`pup-${i}`,motherId:f.id,bornAt:0,stage:'neonate',sex:'M',nursing:[],pregnant:null});w.rats[p.id]=p;f.nursing.push(p.id);}f.lastBirthAt=0;}
 let rng=worldRng(w);const start=performance.now();
 for(let i=0;i<1200;i++){
  const e={...w.env};if(name==='hunger')e.food=0;if(name==='dehydration')e.water=0;if(name==='cold')e.warmth=0;if(name==='heat')e.warmth=1;if(name==='panic'){e.panic=1;e.stress=1;}if(name==='recovery'){e.stress=i<600?1:0;e.panic=i<600?1:0;e.food=e.water=1;}
  if(name.endsWith('burst')||name==='alternating'){const t={id:`${i}`,ts:i*100,side:name==='buy-burst'?'buy':name==='sell-burst'?'sell':i%2?'buy':'sell',usd:i%3===0?1e12:i%3===1?400:200,eth:1,tokens:1,trader:'test',isNewHolder:false,venue:'demo'} as Trade;w.env=applyTrade(e,t);}else w.env=e;
  tick(w,1/600,rng);
  for(const r of Object.values(w.rats)){for(const v of [r.energy,r.heat,r.injury??0,...Object.values(r.hormones),r.wellbeing?.acute??0,r.wellbeing?.chronic??0,r.wellbeing?.hydration??0])assert(Number.isFinite(v)&&v>=0&&v<=1,`${name} seed ${seed}`);assert(Number.isFinite(r.x)&&Number.isFinite(r.y));if(r.socialAction)assert(r.socialAction.partner!==r.id);}
  assert((w.ecology?.history.length??0)<=240);assert((w.ecology?.events.length??0)<=100);
  if(i===600){w=JSON.parse(JSON.stringify(w));rng=worldRng(w);}
 }
 const living=Object.values(w.rats).filter(r=>r.deadAt===null);results.push({name,seed,alive:living.length,deaths:w.totals.deaths,stress:living.reduce((s,r)=>s+(r.wellbeing?.acute??0),0)/(living.length||1),ms:Math.round(performance.now()-start)});
 console.log(name,seed,'PASS');
}
const w=createWorld();for(const usd of [NaN,Infinity,-1])assert.equal(applyTrade(w.env,{usd,ts:1,side:'buy'} as Trade),w.env);
mkdirSync('test-results',{recursive:true});writeFileSync('test-results/stress-matrix.json',JSON.stringify(results,null,2));console.log(`PASS: ${results.length} runs, ${results.length*1200} ticks, 17 stressors, snapshots and invalid input`);
