import {seasonActionInterface} from '../src/market/seasonBurn.js';
import type {ReadRPC} from './market-io.js';
export type SeasonVisualAction={key:string;kind:number;nest:number;points:string;damage:string;blocked:boolean};
/** Bounded, confirmed contract events for presentation. Never changes scoring or payment state. */
export class SeasonEvents {
 private cache:{at:number;value:{available:boolean;items:SeasonVisualAction[]}}|undefined;private pending:Promise<{available:boolean;items:SeasonVisualAction[]}>|undefined;
 constructor(private read:ReadRPC,private router:string,private clock=Date.now){}
 async get(){if(this.cache&&this.clock()-this.cache.at<5000)return this.cache.value;if(this.pending)return this.pending;
  this.pending=this.load().catch(()=>({available:false,items:[] as SeasonVisualAction[]})).then(value=>{this.cache={at:this.clock(),value};return value;}).finally(()=>{this.pending=undefined;});return this.pending;
 }
 private async load(){const head=Number(await this.read('eth_blockNumber',[])),end=head-20;if(!Number.isSafeInteger(end)||end<600)throw Error('Chain unavailable');const topic=seasonActionInterface.getEvent('ActionExecuted')!.topicHash;
  const logs=await this.read('eth_getLogs',[{address:this.router,fromBlock:'0x'+(end-600).toString(16),toBlock:'0x'+end.toString(16),topics:[topic]}]);
  if(!Array.isArray(logs)||logs.length>1000)throw Error('Invalid events');const items:SeasonVisualAction[]=[];
  for(const log of logs){if(log.removed||log.address?.toLowerCase()!==this.router.toLowerCase()||Number(log.blockNumber)>end||Number(log.blockNumber)<end-600)continue;const parsed=seasonActionInterface.parseLog(log);if(!parsed||parsed.name!=='ActionExecuted')continue;const a=parsed.args,kind=Number(a.kind),nest=Number(a.nest);if(kind<0||kind>3||nest<1||nest>3)continue;items.push({key:log.transactionHash+':'+Number(log.logIndex),kind,nest,points:String(a.points),damage:String(a.damage),blocked:Boolean(a.blocked)});}
  return {available:true,items:items.slice(-50)};
 }
}
