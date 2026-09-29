import {Interface} from 'ethers';
import {seasonActionInterface} from '../src/market/seasonBurn.js';
import type {ReadRPC} from './market-io.js';
import type {BurnerChain,BurnerNest,BurnerRecord} from './observer.js';
export const BURNER_ROUTER='0x2374a8a715f5ca87ae43609c9bdc74691d5b7b57';
const TOKEN='0xc322305e79337300b59ff48389f8c9a1d9e0de76';
const abi=new Interface(['function members(address) view returns(uint256 id,uint8 nest)','event Transfer(address indexed from,address indexed to,uint256 value)']);
/** Read-only chain attribution; successful immutable receipts cached, memberships refreshed each board read. */
export class SeasonBurnerChain implements BurnerChain {
 private owners=new Map<string,string>();
 constructor(private read:ReadRPC){}
 async owner(b:BurnerRecord){
  if(b.from!==BURNER_ROUTER)return b.from;
  const key=b.hash+':'+b.logIndex,known=this.owners.get(key);if(known)return known;
  const r=await this.read('eth_getTransactionReceipt',[b.hash]);
  if(!r||Number(r.status)!==1||r.transactionHash?.toLowerCase()!==b.hash.toLowerCase()||Number(r.blockNumber)!==b.block||!Array.isArray(r.logs))throw Error('Unverified burn receipt');
  const burn=r.logs.find((l:any)=>Number(l.logIndex)===b.logIndex&&l.address?.toLowerCase()===TOKEN&&!l.removed);
  const transfer=burn?abi.parseLog(burn):null;
  if(!transfer||transfer.name!=='Transfer'||transfer.args.from.toLowerCase()!==BURNER_ROUTER||transfer.args.to!=='0x0000000000000000000000000000000000000000'||String(transfer.args.value)!==b.units)throw Error('Burn mismatch');
  // execute emits exactly one ActionExecuted after its burn. Bound the match by the next router burn.
  const nextBurn=r.logs.filter((l:any)=>l.address?.toLowerCase()===TOKEN&&Number(l.logIndex)>b.logIndex).find((l:any)=>{try{const t=abi.parseLog(l);return t?.name==='Transfer'&&t.args.from.toLowerCase()===BURNER_ROUTER&&t.args.to==='0x0000000000000000000000000000000000000000';}catch{return false;}});
  const actions=r.logs.filter((l:any)=>!l.removed&&l.address?.toLowerCase()===BURNER_ROUTER&&Number(l.logIndex)>b.logIndex&&(!nextBurn||Number(l.logIndex)<Number(nextBurn.logIndex))).flatMap((l:any)=>{try{const a=seasonActionInterface.parseLog(l);return a?.name==='ActionExecuted'?[a]:[];}catch{return [];}});
  if(actions.length!==1||String(actions[0].args.amount)!==b.units)throw Error('Action attribution unavailable');
  const wallet=actions[0].args.wallet.toLowerCase();if(this.owners.size>=4096)this.owners.delete(this.owners.keys().next().value!);this.owners.set(key,wallet);return wallet;
 }
 async nests(wallets:string[]):Promise<BurnerNest[]>{
  if(!wallets.length)return [];
  const tag=await this.read('eth_blockNumber',[]),out:BurnerNest[]=[];
  // Bounded concurrency; one block gives a consistent current membership snapshot, including switches.
  for(let i=0;i<wallets.length;i+=4)out.push(...await Promise.all(wallets.slice(i,i+4).map(async wallet=>{
   const data=await this.read('eth_call',[{to:BURNER_ROUTER,data:abi.encodeFunctionData('members',[wallet])},tag]);
   const [id,nest]=abi.decodeFunctionResult('members',data);const n=Number(nest);
   if(id===0n&&n===0)return null;if(id===0n||n<1||n>3)throw Error('Invalid membership');
   return (['NVDA','AAPL','AMZN'] as const)[n-1];
  })));
  return out;
 }
}
