import {Interface} from 'ethers';
export const STOCKS=[
 {symbol:'NVDA',name:'NVIDIA',token:'0xd0601CE157Db5bdC3162BbaC2a2C8aF5320D9EEC',feed:'0x379EC4f7C378F34a1B47E4F3cbeBCbAC3E8E9F15'},
 {symbol:'AAPL',name:'Apple',token:'0xaF3D76f1834A1d425780943C99Ea8A608f8a93f9',feed:'0x6B22A786bAa607d76728168703a39Ea9C99f2cD0'},
 {symbol:'AMZN',name:'Amazon',token:'0x12f190a9F9d7D37a250758b26824B97CE941bF54',feed:'0xD5a1508ceD74c084eBf3cBe853e2C968fB2a651C'},
] as const;
// Verified against Robinhood /rhj/assets and Chainlink's Robinhood feed directory, 2026-09-28.
// Display data only. Rolling 24h/7d changes must never be used as Season settlement returns.
const abi=new Interface(['function decimals() view returns(uint8)','function latestRoundData() view returns(uint80,int256,uint256,uint256,uint80)','function oraclePaused() view returns(bool)']);
export type ReadRPC=(method:string,params:unknown[])=>Promise<any>;
const hex=(n:number)=>'0x'+n.toString(16);
export function parseRound(raw:string,decimals:number,blockTime:number){
 const [round,answer,,updated,answered]=abi.decodeFunctionResult('latestRoundData',raw);
 if(!Number.isInteger(decimals)||decimals<0||decimals>18||answer<=0n||updated<=0n||updated>BigInt(blockTime)||answered<round)throw Error('Invalid oracle observation');
 const price=Number(answer)/10**decimals;if(!Number.isFinite(price)||price<=0)throw Error('Invalid price');
 return {price,at:Number(updated)*1000};
}
export async function stockFeed(read:ReadRPC,now=Date.now()){
 if(Number(await read('eth_chainId',[]))!==4663)throw Error('Wrong stock chain');
 const head=await read('eth_getBlockByNumber',['latest',false]);
 const n=Number(head.number),time=Number(head.timestamp);
 if(!Number.isSafeInteger(n)||n<=20||!Number.isSafeInteger(time)||Math.abs(now/1000-time)>180)throw Error('Stale chain');
 const block=await read('eth_getBlockByNumber',[hex(n-20),false]);
 const blockN=Number(block.number),blockTime=Number(block.timestamp);
 const snapshots=new Map<number,Promise<any>>();
 const at=(i:number)=>{if(!snapshots.has(i))snapshots.set(i,read('eth_getBlockByNumber',[hex(i),false]));return snapshots.get(i)!;};
 // Exact block at or before the reference time. Historical reads may be unavailable; never invent 0%.
 const find=async(target:number)=>{let lo=0,hi=blockN;while(lo<hi){const mid=Math.ceil((lo+hi)/2),b=await at(mid);if(!b||!Number.isFinite(Number(b.timestamp)))throw Error('Missing historical block');if(Number(b.timestamp)<=target)lo=mid;else hi=mid-1;}const b=await at(lo);return {number:hex(lo),time:Number(b.timestamp)};};
 const refs=await Promise.allSettled([find(blockTime-86400),find(blockTime-7*86400)]);
 const call=async(to:string,method:string,tag:string)=>read('eth_call',[{to,data:abi.encodeFunctionData(method)},tag]);
 const rows=await Promise.all(STOCKS.map(async s=>{try{
 const tag=hex(blockN),[raw,decRaw,pauseRaw]=await Promise.all([call(s.feed,'latestRoundData',tag),call(s.feed,'decimals',tag),call(s.token,'oraclePaused',tag)]);
 const decimals=Number(abi.decodeFunctionResult('decimals',decRaw)[0]);
 const current=parseRound(raw,decimals,blockTime),paused=Boolean(abi.decodeFunctionResult('oraclePaused',pauseRaw)[0]);
 const changes=await Promise.all(refs.map(async r=>{if(r.status!=='fulfilled')return null;try{const oldDec=Number(abi.decodeFunctionResult('decimals',await call(s.feed,'decimals',r.value.number))[0]);const old=parseRound(await call(s.feed,'latestRoundData',r.value.number),oldDec,r.value.time);if(r.value.time-old.at/1000>4*86400)return null;return {percent:(current.price/old.price-1)*100,referencePrice:old.price,referenceAt:old.at,targetAt:r.value.time*1000};}catch{return null;}}));
 const stale=now-current.at>86400000;
 return {...s,...current,paused,stale,status:paused?'paused':stale?'stale':'available',change24h:paused?null:changes[0],change7d:paused?null:changes[1]};
 }catch{return {...s,status:'unavailable',price:null,at:null,change24h:null,change7d:null};}}));
 return {protocol:1,source:'Chainlink · Robinhood Chain',chainId:4663,asOf:now,block:blockN,blockHash:block.hash,quotes:rows};
}