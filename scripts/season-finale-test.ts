import assert from 'node:assert/strict';
import fs from 'node:fs';
import {id,toQuantity} from 'ethers';
import {seasonResult,RESULT_ABI as abi,SEASON,ROUTER,validateReferences,type ClosingReferences} from '../api/_lib/seasonResult.ts';
import {CLOSE} from '../server/settlement/math.ts';
const code=JSON.parse(fs.readFileSync(new URL('./fixtures/season1-runtime.json',import.meta.url),'utf8')).code;
const refs:ClosingReferences={method:'regular-session-close-split-adjusted-no-dividends',reviewedAt:'2026-10-04T15:00:00Z',rows:['NVDA','AAPL','AMZN'].map(ticker=>({ticker,startDate:'2026-09-25',endDate:'2026-10-02',start:'10000',end:'10000',decimals:2,sources:['https://example.invalid/TEST-FIXTURE-ONLY']})) as ClosingReferences['rows']};
let at=CLOSE-1,slot=929,brokenCode=false,brokenLogs=false,reorg=false;
let scores=[100n,100n,100n],productions=[100n,100n,100n];
const event=(nest:number,index:number)=>{const e=abi.encodeEventLog(abi.getEvent('ActionExecuted')!,[id('quote'+nest),'0x'+'1'.repeat(40),BigInt(nest),0,0,nest,1000,1000,100,0,false]);return {...e,address:ROUTER,blockNumber:toQuantity(75000000),blockHash:id('actions'),logIndex:toQuantity(index),removed:false};};
let blockReads=0;
const read=async(method:string,params:any[])=>{
 if(method==='eth_chainId')return toQuantity(4663);
 if(method==='eth_getBlockByNumber'){blockReads++;return {number:params[0]==='latest'?toQuantity(81000020):toQuantity(81000000),timestamp:toQuantity(at),hash:reorg&&blockReads>2?id('changed'):id('anchor')};}
 if(method==='eth_getCode')return brokenCode?'0x00':code;
 if(method==='eth_getLogs')return brokenLogs?[event(1,3),event(2,2)]:[event(1,3),event(2,2),event(3,1)];
 if(method==='eth_call'){const parsed=abi.parseTransaction({data:params[0].data})!,name=parsed.name;const values:Record<string,any[]>={season:[id(SEASON)],opensAt:[1790611200],closesAt:[CLOSE],colonySlot:[slot],nextMembership:[4]};return abi.encodeFunctionResult(name,name==='nests'?[scores[Number(parsed.args[0])-1],productions[Number(parsed.args[0])-1],0,0,0,0,0]:values[name]);}
 throw Error('Unexpected RPC '+method);
};
const result=()=>{blockReads=0;return seasonResult(read,refs,at*1000);};
assert.equal((await result()).phase,'open');
at=CLOSE;assert.equal((await result()).reason,'final-checkpoints');
slot=930;assert.equal((await seasonResult(read,null,at*1000)).reason,'official-closing-prices');
assert.equal((await result()).winner,'AMZN'); // Equal score/gross: AMZN reached production first.
scores=[120n,100n,100n];assert.equal((await result()).winner,'NVDA');
refs.rows[1].end='10300';assert.equal((await result()).winner,'AAPL'); // +30 is added once.
const complete=await result();assert.equal(complete.ranking[0].finalHalves,'260');assert.equal(complete.ranking[0].weeklyAdjustment,'30');
refs.rows[1].end='1';assert.equal((await result()).ranking.find(r=>r.ticker==='AAPL')!.finalHalves,'0');
brokenLogs=true;await assert.rejects(result,/Incomplete action history/);brokenLogs=false;
brokenCode=true;await assert.rejects(result,/Unexpected season contract/);brokenCode=false;
reorg=true;await assert.rejects(result,/anchor changed/);reorg=false;
await assert.rejects(()=>seasonResult(read,refs,(at+181)*1000),/Stale chain/);
const invalid=structuredClone(refs);invalid.rows[0].end='0';assert.throws(()=>validateReferences(invalid));
console.log('PASS closure boundary, final checkpoint gate, missing official prices, production-order tie, weekly adjustment, zero floor, incomplete logs, runtime, reorg and stale chain');
