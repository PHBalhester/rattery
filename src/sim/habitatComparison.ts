import type {World,Trade} from '../types';
import {CONFIG} from '../config';
import {tick} from './tick';
import {worldRng} from './rng';
import {applyTrade} from './marketMap';
import {individualStress} from './ecology';
export function compareHabitats(source:World,steps=1200){
 const run=(mode:'basic'|'enriched')=>{
  const w:World=JSON.parse(JSON.stringify(source));w.habitatMode=mode;const rng=worldRng(w);let stress=0,thirst=0,samples=0;
  const born=w.totals.pups,dead=w.totals.deaths;
  for(let i=0;i<steps;i++){
   if(i%150===0){const trade:Trade={id:`comparison-${i}`,ts:i*CONFIG.time.tickMs,side:(i/150)%2===0?'buy':'sell',usd:200,eth:200/2400,tokens:1,trader:'comparison',isNewHolder:false,venue:'demo'};w.env=applyTrade(w.env,trade);}
   tick(w,CONFIG.time.simDaysPerTick,rng);
   const alive=Object.values(w.rats).filter(r=>r.deadAt===null);for(const r of alive){stress+=individualStress(r,w.env.stress);thirst+=(r.wellbeing?.hydration??1)<.4?1:0;samples++;}
  }
  return {mode,alive:Object.values(w.rats).filter(r=>r.deadAt===null).length,stress:samples?stress/samples:0,thirst:samples?thirst/samples:0,births:w.totals.pups-born,deaths:w.totals.deaths-dead};
 };
 return {days:steps*CONFIG.time.simDaysPerTick,initialPopulation:Object.values(source.rats).filter(r=>r.deadAt===null).length,results:[run('basic'),run('enriched')]};
}
export type Comparison=ReturnType<typeof compareHabitats>;
