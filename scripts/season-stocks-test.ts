import assert from 'node:assert/strict';
import {Interface} from 'ethers';
import {parseRound,stockFeed,STOCKS} from '../api/_lib/seasonStocks.ts';
const abi=new Interface(['function decimals() view returns(uint8)','function latestRoundData() view returns(uint80,int256,uint256,uint256,uint80)','function oraclePaused() view returns(bool)']);
const round=(price:bigint,time:number,answered=2n)=>abi.encodeFunctionResult('latestRoundData',[2n,price,BigInt(time),BigInt(time),answered]);
assert.throws(()=>parseRound(round(-1n,1),8,10));assert.throws(()=>parseRound(round(1n,11),8,10));assert.throws(()=>parseRound(round(1n,1,1n),8,10));
const start=1700000000,head=1000000,now=(start+head)*1000;
const read=async(method:string,params:any[]):Promise<any>=>{if(method==='eth_chainId')return '0x1237';if(method==='eth_getBlockByNumber'){const n=params[0]==='latest'?head:Number(params[0]);return {number:'0x'+n.toString(16),timestamp:'0x'+(start+n).toString(16),hash:'0x'+'a'.repeat(64)};}
const [{to,data},tag]=params,n=Number(tag),name=abi.parseTransaction({data})!.name;
if(name==='decimals')return abi.encodeFunctionResult(name,[8]);if(name==='oraclePaused')return abi.encodeFunctionResult(name,[to===STOCKS[1].token]);
if(to===STOCKS[2].feed&&n<head-20)throw Error('Archive unavailable');
return round(BigInt(n)*10000n,start+n);};
const feed=await stockFeed(read,now),[nvda,apple,amazon]=feed.quotes;
assert.equal(nvda.status,'available');assert(nvda.change24h&&nvda.change7d);assert.equal(nvda.change24h.targetAt,(start+head-20-86400)*1000);assert.equal(apple.status,'paused');assert.equal(apple.change24h,null);assert.equal(amazon.change7d,null);assert.equal(amazon.status,'available');assert.equal(feed.block,head-20);
await assert.rejects(()=>stockFeed(async()=> '0x1',now),/Wrong stock chain/);
console.log('PASS oracle validation, reference boundaries, paused tokens, archive failure and chain guard');