import {movementSpeed} from './movementSpeed.js';
import {CONFIG} from "../config.js";
import {remember,ecologyState} from './ecology.js';
import type {Rat,World} from '../types.js';
import {findPath,clearPath,advance} from './navigation.js';
import {inNest,tryConceive} from './colony.js';

export const pairKey=(a:Rat,b:Rat)=>[a.id,b.id].sort().join('|');
export function affinity(w:World,a:Rat,b:Rat){
 const key=pairKey(a,b),saved=w.social?.affinities[key];if(saved!==undefined)return saved;
 let hash=w.seed>>>0;for(const c of key)hash=Math.imul(hash^c.charCodeAt(0),16777619)>>>0;
 return ((hash%201)-100)/100;
}
const eligible=(r:Rat)=>r.deadAt===null&&r.stage==='adult'&&!r.pregnant&&!r.nursing.length&&!r.retrieving&&r.energy>.35&&(r.injury??0)<.5;
const distance=(a:Rat,b:Rat)=>Math.hypot(a.x-b.x,a.y-b.y);
function relatives(a:Rat,b:Rat){return a.motherId===b.id||a.fatherId===b.id||b.motherId===a.id||b.fatherId===a.id||!!(a.motherId&&a.motherId===b.motherId)||!!(a.fatherId&&a.fatherId===b.fatherId);}
function start(w:World,a:Rat,b:Rat,kind:'courtship'|'fight'|'groom'){
 const until=w.simDay+3;
 a.socialAction={kind,partner:b.id,until};b.socialAction={kind,partner:a.id,until};
}
/** Saved pair preferences and timers; never uses wall-clock time or Math.random. */
export function socialStep(w:World,dt:number,rng:()=>number){
 const state=w.social??(w.social={affinities:{},cooldown:0,nextAmbient:0});
 const living=Object.values(w.rats).filter(r=>r.deadAt===null);
 const ids=new Set(living.map(r=>r.id));
 for(const key of Object.keys(state.affinities))if(key.split('|').some(id=>!ids.has(id)))delete state.affinities[key];
 for(const r of living){r.injury=Math.max(0,(r.injury??0)-dt*.025*w.env.food);const a=r.socialAction;if(a&&(a.until<=w.simDay||!ids.has(a.partner)))delete r.socialAction;}
 const realNow=w.realStartedAt+w.simDay*CONFIG.time.realMsPerSimDay;
 for(const r of living)if(r.careStimulus&&r.careStimulus.until<=realNow)delete r.careStimulus;
 const group=w.env.groupSignal;delete w.env.groupSignal;
 if(group&&w.simDay>=state.cooldown){
  const free=living.filter(r=>eligible(r)&&!r.socialAction);
  const pairs=free.flatMap((a,i)=>free.slice(i+1).filter(b=>distance(a,b)<80&&(group==='buy'?affinity(w,a,b)>.25:affinity(w,a,b)<-.25)).map(b=>({a,b})));
  if(pairs[0]&&rng()<.35){start(w,pairs[0].a,pairs[0].b,group==='buy'?'groom':'fight');state.cooldown=w.simDay+.5;}
 }
 const signals=w.env.socialSignals??[];w.env.socialSignals=[];
 if(signals.length&&w.simDay>=state.cooldown){
  // A burst produces at most one event; latest market direction takes precedence.
  const side=signals[signals.length-1],free=living.filter(r=>eligible(r)&&!r.socialAction);
  if(side==='buy'){
   for(const female of free.filter(r=>r.sex==='F')){
    const males=free.filter(r=>r.sex==='M'&&!relatives(female,r)&&affinity(w,female,r)>.15).sort((a,b)=>affinity(w,female,b)-affinity(w,female,a)||a.id.localeCompare(b.id));
    if(males[0]){start(w,female,males[0],'courtship');state.cooldown=w.simDay+.5;break;}
   }
  }else{
   const pairs=free.flatMap((a,i)=>free.slice(i+1).filter(b=>affinity(w,a,b)<-.25&&distance(a,b)<160).map(b=>({a,b,score:affinity(w,a,b)}))).sort((a,b)=>a.score-b.score);
   if(pairs[0]){start(w,pairs[0].a,pairs[0].b,'fight');state.cooldown=w.simDay+.5;}
  }
 }
 if(w.simDay>=state.nextAmbient){
  state.nextAmbient=w.simDay+.3;
  const free=living.filter(r=>eligible(r)&&!r.socialAction);
  outer:for(let i=0;i<free.length;i++)for(const b of free.slice(i+1)){const a=free[i];if(distance(a,b)<45&&(affinity(w,a,b)>.25||(affinity(w,a,b)>.15&&Math.min(a.energy,b.energy)<.55&&Math.max(a.energy,b.energy)>.65))&&(w.env.panic<.3||Math.min(a.wellbeing?.acute??1,b.wellbeing?.acute??1)<.4)){start(w,a,b,'groom');break outer;}}
 }
 for(const a of living){
  const action=a.socialAction;if(!action)continue;const b=w.rats[action.partner];if(!b||b.deadAt!==null||b.socialAction?.partner!==a.id){delete a.socialAction;continue;}if(a.id>b.id)continue;
  if(action.kind==='mating')continue;
  if(!eligible(a)||!eligible(b)||(action.kind==='courtship'&&w.env.panic>.45)){delete a.socialAction;delete b.socialAction;continue;}
  const d=distance(a,b);
  if(d>20||!clearPath(a,b)){
   const path=action.path??findPath(a,b);
   if(!path){delete a.socialAction;delete b.socialAction;continue;}
   action.path=path;
   const next=advance(a,path,movementSpeed(a,w));a.vx=next.x-a.x;a.vy=next.y-a.y;a.x=next.x;a.y=next.y;a.inNest=inNest(a);b.vx=b.vy=0;
   continue;
  }
  if(!action.arrived){action.arrived=true;if(action.kind==='fight')remember(w,a,b,'conflicts');if(action.kind==='groom'){const memory=ecologyState(w).memories[pairKey(a,b)];if(memory?.lastKind==='care'||memory?.lastKind==='shared')state.affinities[pairKey(a,b)]=Math.min(1,affinity(w,a,b)+.02);remember(w,a,b,'care');}action.until=w.simDay+.2;b.socialAction!.until=action.until;}

  a.vx=a.vy=b.vx=b.vy=0;
  const key=pairKey(a,b),score=affinity(w,a,b);
  if(action.kind==='courtship'){
   if(w.env.panic>.45){delete a.socialAction;delete b.socialAction;continue;}
   const female=a.sex==='F'?a:b,male=a.sex==='M'?a:b;
   a.socialAction={kind:'mating',partner:b.id,until:w.simDay+.12};b.socialAction={kind:'mating',partner:a.id,until:w.simDay+.12};
   state.affinities[key]=Math.min(1,score+.04);
   // Conception is a single probabilistic attempt, never guaranteed by a trade.
   tryConceive(w,rng,female,male,.25*w.env.food*female.genome.fertility,w.env);
  }else if(action.kind==='fight'){
   a.injury=Math.min(.6,(a.injury??0)+dt*.4);b.injury=Math.min(.6,(b.injury??0)+dt*.4);
   state.affinities[key]=Math.max(-1,score-dt*.03);
  }else if(action.kind==='groom'){
   state.affinities[key]=Math.min(1,score+dt*.08);
   const donor=a.energy>b.energy?a:b,receiver=donor===a?b:a;
   const memory=ecologyState(w).memories[key];
   if(donor.energy>.65&&receiver.energy<.55&&(!memory||w.simDay-memory.last>.1||memory.lastKind!=='shared')){const amount=Math.min(.08,donor.energy-.6);donor.energy-=amount;receiver.energy+=amount;remember(w,donor,receiver,'shared',amount);}
   a.hormones.cort=Math.max(0,a.hormones.cort-dt*.08);b.hormones.cort=Math.max(0,b.hormones.cort-dt*.08);
  }
 }
 // Preference-based local approach/avoidance: neutral pairs exert no force.
 for(const a of living){if(a.socialAction||!eligible(a))continue;for(const b of living){if(a===b)continue;const d=distance(a,b);if(d<.01||d>65)continue;const score=affinity(w,a,b);if(Math.abs(score)<=.15)continue;if(a.careStimulus){const bias=a.careStimulus.kind==='prosocial'?1:-1;state.affinities[pairKey(a,b)]=Math.max(-1,Math.min(1,score+bias*dt*.015));}if(score>0)state.affinities[pairKey(a,b)]=Math.min(1,affinity(w,a,b)+dt*.002);const sign=score>0?1:-1,step=.12*sign;const next={x:a.x+(b.x-a.x)/d*step,y:a.y+(b.y-a.y)/d*step};if(clearPath(a,next)){a.x=next.x;a.y=next.y;}a.inNest=inNest(a);}}
}
