import {assertAllowedName} from './namePolicy.js';
import type { World } from '../types';
export const CARE_RULES={
 mint:{cost:500000,hours:0},name:{cost:0,hours:24},feed:{cost:10000,hours:4},water:{cost:10000,hours:2},pet:{cost:5000,hours:1},play:{cost:5000,hours:2},treat:{cost:5000,hours:8},explore:{cost:10000,hours:1},prosocial:{cost:100000,hours:2},aggression:{cost:100000,hours:2},
} as const;
export type CareAction=keyof typeof CARE_RULES;
export interface CareState {owners:Record<string,string>;cooldowns:Record<string,number>;lastSequence:number;lastTimestamp?:number;burned:number;}
export interface CareEvent {sequence:number;ratId:string;wallet:string;action:CareAction;timestamp:number;amount:number;name?:string;}
export const careState=():CareState=>({owners:{},cooldowns:{},lastSequence:0,burned:0});
const key=(id:string,action:CareAction)=>id+':'+(['prosocial','aggression'].includes(action)?'stimulus':action);
// Caller must authenticate the event against its authoritative payment source.
// This reducer never treats an arbitrary browser receipt as proof of payment.
export function validateCare(w:World,state:CareState,event:CareEvent){
 const rule=Object.prototype.hasOwnProperty.call(CARE_RULES,event.action)?CARE_RULES[event.action]:null;
 if(!rule||!Number.isSafeInteger(event.sequence)||event.sequence!==state.lastSequence+1||!Number.isSafeInteger(event.timestamp)||event.timestamp<=0||!/^0x[0-9a-f]{40}$/.test(event.wallet)||event.amount!==rule.cost)throw new Error('Invalid care event');
 if(event.timestamp<(state.lastTimestamp??0))throw new Error('Care timestamp regressed');
 const rat=w.rats[event.ratId];if(!rat||rat.deadAt!==null)throw new Error('Rat unavailable');
 const owner=state.owners[rat.id];if(owner&&owner!==event.wallet)throw new Error('Only owner may interact');
 if(event.action==='mint'&&owner)throw new Error('Already minted');
 if(event.action==='name'&&!owner)throw new Error('Mint required to name');
 if((state.cooldowns[key(rat.id,event.action)]??0)>event.timestamp)throw new Error('Cooldown active');
 if(['mint','name'].includes(event.action))assertAllowedName(event.name);
 if(!['mint','name','feed','water'].includes(event.action)&&(rat.socialAction||rat.retrieving||rat.energy<.2))throw new Error('Rat busy or needs rest');
 if(['play','explore'].includes(event.action)&&!rat.exploration)throw new Error('Exploration unavailable');
 if(event.action==='treat'&&rat.energy>=1)throw new Error('Already satiated');
 if(event.action==='feed'&&rat.energy>=1)throw new Error('Already satiated');
 if(event.action==='water'&&(!rat.wellbeing||rat.wellbeing.hydration>=1))throw new Error('Water unavailable or not needed');
 if(event.action==='pet'&&(!rat.wellbeing||rat.wellbeing.acute<=0))throw new Error('No acute stress to relieve');
 if(['prosocial','aggression'].includes(event.action)&&rat.stage!=='adult')throw new Error('Adults only');
 return rat;
}
export function applyCare(w:World,state:CareState,event:CareEvent){
 const rat=validateCare(w,state,event),rule=CARE_RULES[event.action];
 switch(event.action){
 case 'mint':state.owners[rat.id]=event.wallet;rat.name=event.name!.trim();state.cooldowns[key(rat.id,'name')]=event.timestamp+86400000;break;
 case 'name':rat.name=event.name!.trim();break;
 case 'feed':rat.energy=Math.min(1,rat.energy+.15);break;
 case 'water':rat.wellbeing!.hydration=Math.min(1,rat.wellbeing!.hydration+.15);break;
 case 'pet':rat.wellbeing!.acute=Math.max(0,rat.wellbeing!.acute-.05*(1-rat.hormones.cort));break;
 case 'treat':rat.energy=Math.min(1,rat.energy+.05);rat.hormones.da=Math.min(1,rat.hormones.da+.1);break;
 case 'play':rat.energy=Math.max(0,rat.energy-.03);rat.hormones.cort=Math.max(0,rat.hormones.cort-.03);if(rat.exploration)rat.exploration.playingUntil=w.simDay+.1;break;
 case 'explore':if(rat.exploration)rat.exploration.restUntil=w.simDay;break;
 case 'prosocial':case 'aggression':rat.careStimulus={kind:event.action,until:event.timestamp+7200000};break;
 }
 state.cooldowns[key(rat.id,event.action)]=event.timestamp+rule.hours*3600000;
 state.lastSequence=event.sequence;state.lastTimestamp=event.timestamp;state.burned+=rule.cost;
}

export const DEMO_WALLETS=['0x'+'1'.repeat(40),'0x'+'2'.repeat(40)] as const;
export function demoCare(w:World,wallet:string,ratId:string,action:CareAction,timestamp:number,name?:string){
 if(!DEMO_WALLETS.includes(wallet as typeof DEMO_WALLETS[number]))throw new Error('Unknown demo account');
 const state=w.care??careState();
 const ledger=w.demoToken??{supply:1000000000,balances:{[DEMO_WALLETS[0]]:5000000,[DEMO_WALLETS[1]]:5000000}};
 const event:CareEvent={sequence:state.lastSequence+1,ratId,wallet,action,timestamp,name,amount:CARE_RULES[action].cost};
 validateCare(w,state,event);
 if((ledger.balances[wallet]??0)<event.amount)throw new Error('Insufficient test tokens');
 applyCare(w,state,event);
 ledger.balances[wallet]-=event.amount;ledger.supply-=event.amount;
 w.care=state;w.demoToken=ledger;
 return event;
}
