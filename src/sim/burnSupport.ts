import type {World} from '../types.js';
export interface BurnSupportState {units:string;events:number;budget:number;budgetAt:number;last?:{hash:string;at:number;points:number;needs:Record<string,number>};}
/** Additive collective support for every genuine burn, including paid care.
 * 10,000 tokens fund 0.15 recovery points. A shared token bucket limits bursts
 * to 3 points and replenishes 3/hour; splitting transactions cannot bypass it.
 * No stored promises of future care, resurrection or immunity.
 */
export function applyBurnSupport(w:World,units:string,at:number,hash:string){
 if(!/^[1-9][0-9]{0,77}$/.test(units)||BigInt(units)>=2n**256n||!Number.isSafeInteger(at)||at<=0)throw Error('Invalid burn support');
 const s=w.burnSupport??{units:'0',events:0,budget:3,budgetAt:at};
 if(at<s.budgetAt)throw Error('Burn support time regressed');
 s.budget=Math.min(3,s.budget+(at-s.budgetAt)*3/3600000);s.budgetAt=at;
 const requested=Math.min(s.budget,Number(BigInt(units))/1e18*.15/10000);
 let remaining=requested;const needs:Record<string,number>={};
 const candidates:{key:string;deficit:()=>number;apply:(n:number)=>void}[]=[];
 const add=(key:string,obj:any,field:string,target:number,lower=false)=>candidates.push({key,deficit:()=>Math.max(0,lower?obj[field]-target:target-obj[field]),apply:n=>{obj[field]+=lower?-n:n;}});
 add('food',w.env,'food',.95);add('water',w.env,'water',.95);add('warmth',w.env,'warmth',.65);add('calm',w.env,'stress',.1,true);
 for(const r of Object.values(w.rats).filter(r=>r.deadAt===null).sort((a,b)=>a.id.localeCompare(b.id))){
  add('energy',r,'energy',.9);
  if(r.wellbeing){add('hydration',r.wellbeing,'hydration',.9);add('stress',r.wellbeing,'acute',.2,true);}
 }
 // At most 60 recovery increments (+ one floating point remainder).
 for(let i=0;i<61&&remaining>1e-12;i++){
  const best=candidates.reduce<typeof candidates[number]|undefined>((a,b)=>!a||b.deficit()>a.deficit()?b:a,undefined);
  if(!best||best.deficit()<=1e-12)break;
  const amount=Math.min(.05,remaining,best.deficit());best.apply(amount);remaining-=amount;needs[best.key]=(needs[best.key]??0)+amount;
 }
 const points=requested-remaining;s.budget=Math.max(0,s.budget-points);
 s.units=(BigInt(s.units)+BigInt(units)).toString();s.events++;s.last={hash,at,points,needs};w.burnSupport=s;
 return {points,needs};
}
