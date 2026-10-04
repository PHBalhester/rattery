import {Interface,id,keccak256,toQuantity} from 'ethers';
import {winner,OPEN,CLOSE,type Nest} from '../../server/settlement/math.js';
import type {ReadRPC} from './seasonStocks.js';
export const ROUTER='0x2374a8a715f5ca87ae43609c9bdc74691d5b7b57';
export const SEASON='RATTERY-SEASON-1-2026-09-28';
export const RUNTIME='0xa178e0412425593b21be2ad608fbc036b4a9c11128d01628b33403d06ee05426';
export const TOTAL_SLOTS=(CLOSE-OPEN)/600;
export const RESULT_ABI=new Interface([
 'function season() view returns(bytes32)','function opensAt() view returns(uint64)',
 'function closesAt() view returns(uint64)','function colonySlot() view returns(uint32)',
 'function nextMembership() view returns(uint256)',
 'function nests(uint8) view returns(uint256,uint256,uint64,uint64,uint64,uint64,uint8)',
 'event ActionExecuted(bytes32 indexed quoteHash,address indexed wallet,uint256 indexed membership,uint256 nonce,uint8 kind,uint8 nest,uint256 amount,uint256 usdCents,uint256 points,uint256 damage,bool blocked)',
]);
export type ClosingReferences={
 method:'regular-session-close-split-adjusted-no-dividends';
 reviewedAt:string;
 rows:{ticker:'NVDA'|'AAPL'|'AMZN';startDate:'2026-09-25';endDate:'2026-10-02';start:string;end:string;decimals:number;sources:string[]}[];
};
const tickers=['NVDA','AAPL','AMZN'] as const;
export function validateReferences(refs:ClosingReferences){
 if(refs.method!=='regular-session-close-split-adjusted-no-dividends'||!Number.isFinite(Date.parse(refs.reviewedAt))||refs.rows.length!==3)throw Error('Unreviewed closing prices');
 return tickers.map(ticker=>{const rows=refs.rows.filter(r=>r.ticker===ticker),r=rows[0];
  if(rows.length!==1||r.startDate!=='2026-09-25'||r.endDate!=='2026-10-02'||!Number.isInteger(r.decimals)||r.decimals<0||r.decimals>18||!/^\d+$/.test(r.start)||!/^\d+$/.test(r.end)||BigInt(r.start)<=0n||BigInt(r.end)<=0n||!r.sources.length||r.sources.some(s=>!s.startsWith('https://')))throw Error('Invalid closing prices');
  return r;
 });
}
/** Read-only and fail-closed: no predicted winner, wallet operations or fallback prices. */
export async function seasonResult(read:ReadRPC,refs:ClosingReferences|null,now=Date.now()){
 const base={protocol:1,season:SEASON,opensAt:OPEN*1000,closesAt:CLOSE*1000,serverAt:now,paymentStatus:'planned-monday-late-morning',requiredCheckpoints:TOTAL_SLOTS};
 if(Number(await read('eth_chainId',[]))!==4663)throw Error('Wrong chain');
 const head=await read('eth_getBlockByNumber',['latest',false]);
 if(!head||!Number.isSafeInteger(Number(head.number))||Number(head.number)<20||Math.abs(Number(head.timestamp)-now/1000)>180)throw Error('Stale chain');
 const block=await read('eth_getBlockByNumber',[toQuantity(Number(head.number)-20),false]);
 if(!block||Number(block.timestamp)>Number(head.timestamp)||!/^0x[0-9a-f]{64}$/i.test(block.hash))throw Error('Invalid confirmed block');
 const tag=block.number,call=async(name:string,args:unknown[]=[])=>RESULT_ABI.decodeFunctionResult(name,await read('eth_call',[{to:ROUTER,data:RESULT_ABI.encodeFunctionData(name,args)},tag]));
 const [code,season,open,close,slot]=await Promise.all([read('eth_getCode',[ROUTER,tag]),call('season'),call('opensAt'),call('closesAt'),call('colonySlot')]);
 if(keccak256(code)!==RUNTIME||season[0]!==id(SEASON)||Number(open[0])!==OPEN||Number(close[0])!==CLOSE||Number(slot[0])>TOTAL_SLOTS)throw Error('Unexpected season contract');
 const status={...base,block:Number(block.number),blockHash:block.hash,confirmedCheckpoints:Number(slot[0])};
 if(Number(head.timestamp)<CLOSE)return {...status,phase:Number(head.timestamp)<OPEN?'scheduled':'open',winner:null,reason:null,ranking:[]};
 if(Number(block.timestamp)<CLOSE||Number(slot[0])!==TOTAL_SLOTS)return {...status,phase:'awaiting',reason:'final-checkpoints',winner:null,ranking:[]};
 if(!refs)return {...status,phase:'awaiting',reason:'official-closing-prices',winner:null,ranking:[]};
 const prices=validateReferences(refs);
 const nests=await Promise.all([1,2,3].map(n=>call('nests',[n]))),members=await call('nextMembership');
 // Only action logs are needed for the gross-production tie-break. Reconcile their totals
 // against contract storage so truncated RPC responses can never select a winner.
 const topic=RESULT_ABI.getEvent('ActionExecuted')!.topicHash;
 let requests=0;
 async function logs(from:number,to:number):Promise<any[]>{
  if(++requests>96)throw Error('Action history unavailable');
  try{const rows=await read('eth_getLogs',[{address:ROUTER,fromBlock:toQuantity(from),toBlock:toQuantity(to),topics:[topic]}]);if(!Array.isArray(rows)||rows.length>=1000)throw Error('Split history');return rows;}
  catch(error){if(from===to)throw error;const mid=Math.floor((from+to)/2);return [...await logs(from,mid),...await logs(mid+1,to)];}
 }
 const events=(await logs(74924031,Number(block.number))).sort((a,b)=>Number(a.blockNumber)-Number(b.blockNumber)||Number(a.logIndex)-Number(b.logIndex));
 const gross=[0n,0n,0n],order=[0n,0n,0n],seen=new Set<string>();let entries=0n;
 for(const log of events){
  const key=log.blockHash+':'+log.logIndex;
  if(log.removed||seen.has(key)||log.address.toLowerCase()!==ROUTER||Number(log.blockNumber)<74924031||Number(log.blockNumber)>Number(block.number))throw Error('Invalid action history');seen.add(key);
  const e=RESULT_ABI.parseLog(log)!.args,n=Number(e.nest)-1,kind=Number(e.kind);
  if(n<0||n>2||kind<0||kind>3||e.points!==([100n,20n,0n,0n][kind]))throw Error('Invalid action');
  if(kind===0)entries++;
  if(e.points>0n){gross[n]+=e.points;order[n]=BigInt(log.blockNumber)*1000000n+BigInt(log.logIndex);}
 }
 if(entries+1n!==members[0]||nests.some((n,i)=>n[1]!==gross[i]||n[6]>1n))throw Error('Incomplete action history');
 const ranking=winner(nests.map((n,i)=>({nest:(i+1) as Nest,halves:n[0]*2n+n[6],gross:n[1],lastProductionOrder:order[i],startPrice:BigInt(prices[i].start),endPrice:BigInt(prices[i].end)}))).map(r=>({nest:r.nest,ticker:tickers[r.nest-1],baseHalves:String(r.halves),weeklyAdjustment:String(r.adjustment),finalHalves:String(r.finalHalves),gross:String(r.gross),lastProductionOrder:String(r.lastProductionOrder)}));
 // Recheck the anchor after the history read. A reorg requires a fresh computation.
 if((await read('eth_getBlockByNumber',[tag,false]))?.hash!==block.hash)throw Error('Result anchor changed');
 const resultId=keccak256(new TextEncoder().encode(JSON.stringify({season:SEASON,ranking,references:refs})));
 return {...status,phase:'complete',reason:null,winner:ranking[0].ticker,ranking,resultId,references:refs};
}
