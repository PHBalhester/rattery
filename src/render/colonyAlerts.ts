import type {World} from '../types';
import {individualStress,zoneOf} from '../sim/ecology';
import {colonyMetrics} from '../sim/colonyMetrics';
export type ColonyAlert={key:string;critical:boolean;count?:number};
/** Display thresholds only. These do not change biology or claim clinical validity. */
export function colonyAlerts(w:World,m=colonyMetrics(w)):ColonyAlert[]{
 const a:ColonyAlert[]=[];const living=Object.values(w.rats).filter(r=>r.deadAt===null);
 for(const key of ['hunger','thirst','cold','hot','stress','crowdPressure','isolation'] as const)if(m[key]>=.45&&living.length)a.push({key,critical:m[key]>=.75});
 for(const [key,test] of [['dehydrated',(r:typeof living[number])=>(r.wellbeing?.hydration??1)<.4],['exhausted',(r:typeof living[number])=>r.energy<.2],['injured',(r:typeof living[number])=>(r.injury??0)>.15]] as const){const count=living.filter(test).length;if(count)a.push({key,critical:key==='exhausted'||(key==='dehydrated'?living.some(r=>(r.wellbeing?.hydration??1)<.2):living.some(r=>(r.injury??0)>.5)),count});}
 if(m.critical)a.push({key:'criticalStress',critical:true,count:m.critical});
 if(m.occupancy>=.85)a.push({key:'capacity',critical:m.occupancy>=1});
 if(m.localZones.some(z=>z.count>z.capacity))a.push({key:'localCapacity',critical:true});
 if(m.conflicts)a.push({key:'conflicts',critical:m.conflicts>=3,count:m.conflicts});
 if(m.populationPhase==='declining')a.push({key:'declining',critical:false});
 if(!living.length)a.push({key:'extinct',critical:true});
 return a.sort((x,y)=>Number(y.critical)-Number(x.critical));
}

// Individual alerts use the same thresholds as their counts; collective alerts show context.
export function alertResidents(w:World,key:string,m=colonyMetrics(w)){
 const living=Object.values(w.rats).filter(r=>r.deadAt===null);
 const conflicts=new Set((w.ecology?.events??[]).filter(e=>e.kind==='conflicts'&&w.simDay-e.day<=1).flatMap(e=>[e.a,e.b]));
 return living.filter(r=>{
  switch(key){
   case 'dehydrated':return (r.wellbeing?.hydration??1)<.4;
   case 'exhausted':return r.energy<.2;
   case 'injured':return (r.injury??0)>.15;
   case 'criticalStress':return individualStress(r,w.env.stress)>.75;
   case 'stress':return individualStress(r,w.env.stress)>=.45;
   case 'isolation':return (r.wellbeing?.isolationDistress??0)>=.45;
   case 'crowdPressure':return (r.wellbeing?.crowding??0)>=.45;
   case 'localCapacity':{const z=m.localZones[zoneOf(r)];return !!z&&z.count>z.capacity;}
   case 'conflicts':return conflicts.has(r.id);
   case 'extinct':return false;
   default:return true;
  }
 }).sort((a,b)=>key==='dehydrated'?(a.wellbeing?.hydration??1)-(b.wellbeing?.hydration??1):key==='exhausted'?a.energy-b.energy:key==='injured'?(b.injury??0)-(a.injury??0):key==='criticalStress'||key==='stress'?individualStress(b,w.env.stress)-individualStress(a,w.env.stress):a.name.localeCompare(b.name)||a.id.localeCompare(b.id));
}
