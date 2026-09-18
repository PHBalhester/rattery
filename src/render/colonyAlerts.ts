import type {World} from '../types';
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
