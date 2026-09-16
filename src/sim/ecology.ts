import type {World,Rat} from '../types';
import {habitatRoutes,wheelToys,diggingToy} from './habitatLayout';
import {NEST_POS} from './colony';
import {affinity,pairKey} from './social';
const clamp=(n:number)=>Math.max(0,Math.min(1,n));
export const zones=[{name:'nest',x:NEST_POS.x,y:NEST_POS.y,capacity:18},...habitatRoutes.map((r,i)=>({name:`chamber ${i+1}`,x:r[81].x,y:r[81].z,capacity:14}))];
export function zoneOf(r:{x:number;y:number}){let best=0;for(let i=1;i<zones.length;i++)if(Math.hypot(r.x-zones[i].x,r.y-zones[i].y)<Math.hypot(r.x-zones[best].x,r.y-zones[best].y))best=i;return best;}
export function ecologyState(w:World){return w.ecology??(w.ecology={nextSample:0,history:[],memories:{},events:[]});}
export function remember(w:World,a:Rat,b:Rat,kind:'care'|'conflicts'|'shared',amount=1){const e=ecologyState(w),key=pairKey(a,b),m=e.memories[key]??(e.memories[key]={care:0,conflicts:0,shared:0,last:0,lastKind:kind});m[kind]+=amount;m.last=w.simDay;m.lastKind=kind;e.events.push({day:w.simDay,kind,a:a.id,b:b.id});e.events=e.events.slice(-100);}
export function ecologyStep(w:World,dt:number){
 const e=ecologyState(w),living=Object.values(w.rats).filter(r=>r.deadAt===null),ids=new Set(living.map(r=>r.id)),counts=zones.map(()=>0);
 for(const r of living)counts[zoneOf(r)]++;
 for(const key of Object.keys(e.memories))if(key.split('|').some(id=>!ids.has(id)))delete e.memories[key];
 // Read the previous state for all partners: iteration order must not change support.
 const calm=new Map(living.map(r=>[r.id,1-(r.wellbeing?.acute??w.env.stress)]));
 for(const r of living){const z=zoneOf(r),near=living.filter(q=>q!==r&&Math.hypot(q.x-r.x,q.y-r.y)<65),pressure=clamp(Math.max((counts[z]/zones[z].capacity-.65)/.8,(near.length-5)/16));
 const support=clamp(near.reduce((sum,q)=>sum+Math.max(0,affinity(w,r,q))*calm.get(q.id)!,0)/3);
 const state=r.wellbeing??(r.wellbeing={acute:w.env.stress,chronic:0,hydration:.7,lastWater:w.simDay,cause:'settling',support:0,crowding:0,zone:z});
 const atResource=(w.habitatMode!=='basic'||z===0)&&Math.hypot(r.x-zones[z].x,r.y-zones[z].y)<65,access=atResource?Math.min(1,6/Math.max(1,near.length+1)):0;
 const milk=r.stage==='neonate'||r.stage==='juvenile';
 const water=(w.env.water??.55)*access;
 state.hydration=clamp(state.hydration+dt*(water*.9-.12));
 if(milk&&r.motherId&&w.rats[r.motherId]?.deadAt===null&&w.rats[r.motherId].nursing.includes(r.id))state.hydration=clamp(state.hydration+dt*.3);
 if(water>.15)state.lastWater=w.simDay;
 const active=w.habitatMode!=='basic'&&!r.socialAction&&!r.retrieving&&w.env.panic<=.45&&r.energy>=.28&&(r.wellbeing?.hydration??1)>=.4&&(r.wellbeing?.chronic??0)<=.5&&(r.exploration?.playingUntil??0)>w.simDay;
 if(active&&wheelToys.has(r.exploration!.route))r.energy=clamp(r.energy-dt*.06);
 if(active&&r.exploration!.route===diggingToy)r.energy=clamp(r.energy+dt*(w.env.food*.16-.04));
 if(!milk)r.energy=clamp(r.energy-dt*.035*(1-access)*pressure);
 const isolation=living.length>1&&!near.length ? .12 : 0;
 const causes=[{name:'market alarm',v:w.env.stress*.65},{name:`crowding in ${zones[z].name}`,v:pressure*.75},{name:'thirst',v:(1-state.hydration)*.4},{name:'hunger',v:(1-r.energy)*.3},{name:'isolation',v:isolation}];
 const relief=support*.3+(active?.12:0);
 const target=clamp(causes.reduce((sum,c)=>sum+c.v,0)-relief);
 state.acute+=(target-state.acute)*(1-Math.exp(-dt*8));
 state.chronic+=(state.acute-state.chronic)*(1-Math.exp(-dt*.3));
 state.cause=causes.sort((a,b)=>b.v-a.v)[0].name;state.support=support;state.crowding=pressure;state.zone=z;
 }
 if(w.simDay>=e.nextSample){e.nextSample=w.simDay+.25;e.history.push({day:w.simDay,population:living.length,stress:living.reduce((s,r)=>s+r.wellbeing!.acute,0)/(living.length||1),births:w.totals.pups,deaths:w.totals.deaths});e.history=e.history.slice(-240);}
}
export function individualStress(r:Rat,fallback:number){return r.wellbeing?clamp(r.wellbeing.acute*.7+r.wellbeing.chronic*.3):fallback;}
