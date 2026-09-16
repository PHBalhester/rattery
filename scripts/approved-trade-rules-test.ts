import assert from "node:assert/strict";
import {writeFileSync} from "node:fs";
import {applyTrade,emptyEnv,BIG_TRADE_USD,GIANT_TRADE_USD} from "../src/sim/marketMap";
import type {Trade} from "../src/types";
const results:{name:string,passed:boolean,error?:string}[]=[];
function check(name:string,fn:()=>void){try{fn();results.push({name,passed:true});}catch(e){results.push({name,passed:false,error:(e as Error).message});}}
const trade=(side:"buy"|"sell",usd:number)=>({id:"test",ts:1000,side,usd,eth:usd/2400,tokens:1,trader:"0x"+"1".repeat(40),isNewHolder:false,venue:"demo"} as Trade);
check("Large threshold is USD 500",()=>assert.equal(BIG_TRADE_USD,500));
check("Giant threshold is USD 1000",()=>assert.equal(GIANT_TRADE_USD,1000));
for(const side of ["buy","sell"] as const){
 check(`${side}: zero has no effect`,()=>{const env=emptyEnv();assert.deepEqual(applyTrade(env,trade(side,0)),env);});
 for(const usd of [0.01,1,49.99])check(`${side} ${usd}: no direct behavioral pulse`,()=>{
  const env=emptyEnv(),next=applyTrade(env,trade(side,usd));
  assert.deepEqual({forage:next.forage,panic:next.panic,dopamine:next.dopaminePulse,signals:next.socialSignals},{forage:env.forage,panic:env.panic,dopamine:env.dopaminePulse,signals:env.socialSignals});
 });
 for(const usd of [49.99,50,249.99,250,499.99,500,999.99,1000,1000.01])check(`${side} ${usd}: giant signal boundary`,()=>{
  const next=applyTrade(emptyEnv(),trade(side,usd));assert.equal(next.socialSignals?.length??0,usd>=1000?1:0);
 });
 check(`${side}: frequent small trades do not saturate resources/stress immediately`,()=>{
  let env=emptyEnv();for(let n=0;n<100;n++)env=applyTrade(env,{...trade(side,1),id:String(n),ts:1000+n});
  assert(env.food>0&&env.food<1&&env.stress>0&&env.stress<1);
 });
 for(const usd of [-1,NaN,Infinity])check(`${side}: invalid ${usd} rejected`,()=>{const env=emptyEnv();assert.equal(applyTrade(env,trade(side,usd)),env);});
}
const report={approvedRulesImplemented:results.every(r=>r.passed),passed:results.filter(r=>r.passed).length,failed:results.filter(r=>!r.passed).length,results};
writeFileSync("test-results/approved-trade-rules-test.json",JSON.stringify(report,null,2));
console.log(JSON.stringify({passed:report.passed,failed:report.failed,failures:results.filter(r=>!r.passed).map(r=>r.name)},null,2));
if(report.failed)process.exitCode=1;
