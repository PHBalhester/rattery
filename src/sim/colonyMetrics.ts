import {zones,zoneOf,individualStress} from './ecology';
import {crowding} from './crowding';
import {affinity} from './social';
import type {Rat,World} from '../types';
import {CONFIG} from '../config';
import {playActivity} from './playActivity';
const clamp=(n:number)=>Math.max(0,Math.min(1,n));
export type Bond={a:Rat;b:Rat;strength:number;distance:number};
export function colonyMetrics(world:World){
 const rats=Object.values(world.rats).filter(r=>r.deadAt===null),n=rats.length,capacity=CONFIG.colony.maxAlive,density=clamp(n/capacity);
 let energy=0,heat=0,isolated=0,nest=0,closePairs=0;const bonds:Bond[]=[];
 for(const r of rats){energy+=r.energy;heat+=r.heat;if(r.inNest)nest++;let nearest=Infinity;for(const q of rats){if(q===r)continue;const d=Math.hypot(r.x-q.x,r.y-q.y);nearest=Math.min(nearest,d);if(r.id<q.id){const strength=affinity(world,r,q);if(Math.abs(strength)>.15)bonds.push({a:r,b:q,strength,distance:d});if(d<55)closePairs++;}}if(nearest>150)isolated++;}
 bonds.sort((a,b)=>Math.abs(b.strength)-Math.abs(a.strength));
 const load=crowding(n,world.env.stress),crowdPressure=n?rats.reduce((sum,r)=>sum+(r.wellbeing?.crowding??0),0)/n:0;
 const cohesion=n>1?clamp(1-isolated/n):1,cold=clamp((.48-world.env.warmth)/.48),hot=clamp((world.env.warmth-.78)/.22),hunger=clamp(1-(n?energy/n:0)),thirst=clamp(1-(world.env.water??.55));
 const nursing=rats.reduce((sum,r)=>sum+r.nursing.length,0),pregnant=rats.filter(r=>!!r.pregnant).length,playing=[...playActivity].filter(([id])=>world.rats[id]?.deadAt===null).length;
 const socialTone=crowdPressure>.8?'critical local crowding':world.env.panic>.45?'alarm / retreat':cold>.45?'huddling for warmth':crowdPressure>.65?'crowding tension':world.env.forage>.35?'collective foraging':cohesion>.7?'stable social clusters':'dispersed exploration';
 const history=world.ecology?.history??[],past=history[Math.max(0,history.length-5)],latest=history[history.length-1];
 const populationPhase=!n?'extinct':past&&latest&&latest.population<past.population?'declining':past&&latest&&latest.population>past.population?'growing':rats.filter(r=>world.simDay-r.bornAt>250).length>n/2?'aging':density>.85?'saturated':'stable';
 const localZones=zones.map((z,i)=>({...z,count:rats.filter(r=>zoneOf(r)===i).length}));
 const causes=new Map<string,number>();for(const r of rats)if(r.wellbeing)causes.set(r.wellbeing.cause,(causes.get(r.wellbeing.cause)??0)+1);
 const mainCause=[...causes].sort((a,b)=>b[1]-a[1])[0]?.[0]??'settling';
 const critical=rats.filter(r=>individualStress(r,world.env.stress)>.75).length;
 const thirsty=rats.filter(r=>(r.wellbeing?.hydration??1)<.4).length;
 const conflicts=(world.ecology?.events??[]).filter(e=>e.kind==='conflicts'&&world.simDay-e.day<=1).length;
 return {populationPhase,localZones,mainCause,critical,thirsty,conflicts,history,n,occupancy:load.occupancy,capacity,density,crowdPressure,cohesion,isolation:n?rats.reduce((sum,r)=>sum+(r.wellbeing?.isolationDistress??0),0)/n:0,nest:n?nest/n:0,hunger,thirst,cold,hot,stress:n?rats.reduce((sum,r)=>sum+individualStress(r,world.env.stress),0)/n:0,playing,closePairs,nursing,pregnant,bonds:bonds.slice(0,5),socialTone};
}
