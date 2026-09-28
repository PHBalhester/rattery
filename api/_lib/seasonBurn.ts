import {Interface, keccak256} from 'ethers';
import {seasonBurnCall,seasonQuoteHash,seasonActionInterface,type SeasonBurnConfig,type SeasonQuote} from '../../src/market/seasonBurn.js';
import type {BurnRPC} from './burn.js';
export interface SeasonBurnIntent {config:SeasonBurnConfig;quote:SeasonQuote;signature:string;routerCodeHash:string;}
const transfers=new Interface(['event Transfer(address indexed from,address indexed to,uint256 value)']);
const lower=(v:unknown)=>typeof v==='string'?v.toLowerCase():'';
const hashPattern=/^0x[0-9a-fA-F]{64}$/;
/** Read-only receipt verification. Caller must persist this unique key and action atomically.
 * Unlike the legacy direct-burn verifier, the trusted router already enforced expiry on-chain.
 */
export async function verifySeasonBurn(rpc:BurnRPC,hash:string,intent:SeasonBurnIntent){
 if(!hashPattern.test(hash)||!hashPattern.test(intent.routerCodeHash))throw Error('Invalid season receipt input');
 const {config,quote:q}=intent,call=seasonBurnCall(config,q,intent.signature),digest=seasonQuoteHash(config,q);
 if(Number(await rpc('eth_chainId',[]))!==config.chainId)throw Error('Wrong chain');
 const tx=await rpc('eth_getTransactionByHash',[hash]),receipt=await rpc('eth_getTransactionReceipt',[hash]);
 if(!tx||!receipt)throw Error('Season burn pending');
 if(lower(tx.hash)!==lower(hash)||lower(receipt.transactionHash)!==lower(hash)||lower(tx.from)!==lower(q.wallet)||lower(receipt.from)!==lower(q.wallet)||lower(tx.to)!==lower(call.to)||lower(receipt.to)!==lower(call.to)||lower(tx.input)!==lower(call.data)||BigInt(tx.value??'1')!==0n)throw Error('Season transaction mismatch');
 if(Number(receipt.status)!==1)throw Error('Season action reverted');
 const block=Number(receipt.blockNumber),head=Number(await rpc('eth_blockNumber',[]));
 if(!Number.isSafeInteger(block)||block<0||!Number.isSafeInteger(head)||head-block<(config.chainId===4663?20:4))throw Error('Season burn not confirmed');
 const anchor=await rpc('eth_getBlockByNumber',[receipt.blockNumber,false]);
 if(!hashPattern.test(anchor?.hash)||lower(anchor.hash)!==lower(receipt.blockHash)||Number(anchor.number)!==block||!/^0x[0-9a-f]+$/i.test(anchor.timestamp??''))throw Error('Season anchor mismatch');
 const timestamp=BigInt(anchor.timestamp);
 if(timestamp<q.issuedAt||timestamp>=q.expiresAt)throw Error('Season execution time mismatch');
 const code=await rpc('eth_getCode',[config.router,receipt.blockNumber]);
 if(lower(keccak256(code))!==lower(intent.routerCodeHash))throw Error('Untrusted season router');
 const logs=receipt.logs??[];
 const parsed=logs.filter((l:any)=>lower(l.address)===lower(config.router)&&!l.removed).map((l:any)=>{try{return {log:l,event:seasonActionInterface.parseLog(l)};}catch{return null;}}).filter((x:any)=>x?.event?.name==='ActionExecuted');
 if(parsed.length!==1)throw Error('Expected one season action');
 const {log,event}=parsed[0],a=event.args;
 if(lower(a.quoteHash)!==lower(digest)||lower(a.wallet)!==lower(q.wallet)||a.nonce!==q.nonce||Number(a.kind)!==q.kind||Number(a.nest)!==q.nest||a.amount!==q.amount||a.usdCents!==q.usdCents||a.membership<=0n||(q.kind!==0&&a.membership!==q.membership))throw Error('Season event mismatch');
 const tokenEvents=logs.filter((l:any)=>lower(l.address)===lower(config.token)&&!l.removed).map((l:any)=>{try{return {log:l,event:transfers.parseLog(l)};}catch{return null;}}).filter((x:any)=>x?.event?.name==='Transfer');
 const transfer=tokenEvents.filter((x:any)=>lower(x.event.args.from)===lower(q.wallet)&&lower(x.event.args.to)===lower(config.router)&&x.event.args.value===q.amount);
 const burn=tokenEvents.filter((x:any)=>lower(x.event.args.from)===lower(config.router)&&lower(x.event.args.to)==='0x'+'0'.repeat(40)&&x.event.args.value===q.amount);
 if(transfer.length!==1||burn.length!==1)throw Error('Expected exact transfer and burn');
 const indexes=[transfer[0].log.logIndex,burn[0].log.logIndex,log.logIndex].map(Number);
 if(!indexes.every(n=>Number.isSafeInteger(n)&&n>=0)||!(indexes[0]<indexes[1]&&indexes[1]<indexes[2]))throw Error('Season log order mismatch');
 return {key:`${config.chainId}:${lower(config.router)}:${lower(hash)}:${indexes[2]}`,hash:lower(hash),block,blockHash:lower(anchor.hash),timestamp:timestamp.toString(),quoteHash:digest,wallet:lower(q.wallet),membership:a.membership.toString(),amount:q.amount.toString(),points:a.points.toString(),damage:a.damage.toString(),blocked:a.blocked};
}
