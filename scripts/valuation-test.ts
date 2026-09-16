import assert from 'node:assert/strict';
import {historicalValuation} from '../server/valuation';
const sources=new Set(['operator-reviewed-provider']);
const trade={chainId:46630,token:'0x'+'a'.repeat(40),hash:'0x'+'b'.repeat(64),logIndex:0,timestamp:1800000000000,ethWei:'1000000000000000000'};
const quote={source:'operator-reviewed-provider',observedAt:trade.timestamp,usdMicrosPerEth:'2400000000'};
assert.equal(historicalValuation(trade,null,sources).status,'pending');
for(const [usd,tier] of [[49,'light'],[50,'small'],[249,'small'],[250,'medium'],[499,'medium'],[500,'large'],[999,'large'],[1000,'giant']] as const){
 const v=historicalValuation(trade,{...quote,usdMicrosPerEth:String(usd*1000000)},sources);
 assert.equal(v.status==='classified'&&v.tier,tier);
}
for(const q of [{...quote,source:'untrusted'},{...quote,observedAt:trade.timestamp+1},{...quote,observedAt:trade.timestamp-300001},{...quote,usdMicrosPerEth:'NaN'},{...quote,usdMicrosPerEth:'-1'}])assert.throws(()=>historicalValuation(trade,q,sources));
for(let i=0;i<10000;i++){const t={...trade,ethWei:(BigInt(i)*1234567891234567n).toString()};const result=historicalValuation(t,quote,sources);assert.deepEqual(historicalValuation(JSON.parse(JSON.stringify(t)),JSON.parse(JSON.stringify(quote)),sources),result);}
console.log('PASS: historical valuation pending-without-quote, exact thresholds, 5 invalid quote cases and 10000 deterministic JSON roundtrips. Existing replay unchanged.');
