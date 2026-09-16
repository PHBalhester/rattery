import assert from "node:assert/strict";
import {writeFileSync} from "node:fs";
import {CONFIG} from "../src/config";
import {createWorld} from "../src/sim/colony";
import {worldRng} from "../src/sim/rng";
import {makeReplay,tagNewHolders} from "../src/sim/replay";
import {sealSnapshot,validateSnapshot} from "../src/sim/snapshot";
import handler from "../api/snapshot";
import {fetchAllHistory} from "../src/market/onchain";
import type {Trade} from "../src/types";
const identity={chainId:4663,token:"0x1111111111111111111111111111111111111111",birthBlock:1000};
const t0=1700000000000;
const trades:Trade[]=Array.from({length:40},(_,i)=>({id:"tx-"+i,ts:t0+Math.floor(i/4)*100,block:1000+Math.floor(i/4),logIndex:i%4,side:i%2?"buy":"sell",usd:500,eth:500/2400,tokens:1,trader:"0x"+(i%3+1).toString(16).padStart(40,"0"),venue:"curve",isNewHolder:false}));
const world=createWorld(CONFIG.colony.seed);world.realStartedAt=t0;world.env.lastTradeAt=t0;
const consumed=trades.filter(t=>t.ts<t0+500),holders=tagNewHolders(consumed);
const options={t0,targetTick:5,tickMs:100,dtDays:CONFIG.time.simDaysPerTick,maxTicks:100};
const a=makeReplay(world,worldRng(world),consumed,options);a.step(5);
const snapshot=await sealSnapshot({identity,t0,cursor:a.cursor(),anchor:{block:1009,hash:"0x"+"a".repeat(64),timestamp:t0+900},holders:[...holders],world});
assert.deepEqual(await validateSnapshot(snapshot,identity),snapshot);
for(const change of [(s:any)=>s.identity.token="0x"+"2".repeat(40),(s:any)=>s.identity.chainId=46630,(s:any)=>s.model="old",(s:any)=>s.configHash="old",(s:any)=>s.world.env.food=999,(s:any)=>s.cursor.tick=NaN,(s:any)=>s.world.simDay="bad",(s:any)=>s.anchor.hash="bad"]){const bad=structuredClone(snapshot);change(bad);await assert.rejects(validateSnapshot(bad,identity));}
const restored=await validateSnapshot(snapshot,identity),tail=trades.filter(t=>(t.block!*100000+t.logIndex!)>restored.cursor.lastKey);tagNewHolders(tail,new Set(restored.holders));
const b=makeReplay(restored.world,worldRng(restored.world),tail,{...options,targetTick:20,resume:restored.cursor});while(!b.done())b.step(3);
const full=createWorld(CONFIG.colony.seed);full.realStartedAt=t0;full.env.lastTradeAt=t0;tagNewHolders(trades);const r=makeReplay(full,worldRng(full),trades,{...options,targetTick:20});r.step(20);assert.equal(JSON.stringify(restored.world),JSON.stringify(full));
process.env.RATTERY_CHAIN_ID="4663";process.env.RATTERY_CA=identity.token;process.env.RATTERY_BIRTH_BLOCK="1000";process.env.RATTERY_SNAPSHOT_URL="https://snapshot.test/latest.json";
let fault="",status=0,body:any;const native=globalThis.fetch;
globalThis.fetch=(async(url:any,init:any)=>{
 if(String(url).includes("snapshot.test"))return Response.json(snapshot);
 const q=JSON.parse(init.body);let result:any;
 if(q.method==="eth_chainId")result=fault==="chain"?"0xb626":"0x1237";
 if(q.method==="eth_blockNumber")result="0x"+(fault==="unconfirmed"?1010:1020).toString(16);
 if(q.method==="eth_getBlockByNumber")result={hash:fault==="reorg"?"0x"+"b".repeat(64):snapshot.anchor.hash,timestamp:"0x"+((snapshot.anchor.timestamp)/1000).toString(16)};
 return Response.json({jsonrpc:"2.0",id:q.id,result});
}) as typeof fetch;
// Millisecond anchors must correspond to actual whole-second block timestamps.
const stable=await sealSnapshot({...snapshot,anchor:{...snapshot.anchor,timestamp:t0+1000}});
Object.assign(snapshot,stable);
const res:any={setHeader(){},status(n:number){status=n;return res},json(b:any){body=b},end(){}};
await handler({method:"GET",query:{}},res);assert.equal(status,200,JSON.stringify(body));assert(body.snapshot);
for(const mode of ["chain","unconfirmed","reorg"]){fault=mode;await handler({method:"GET",query:{}},res);assert.equal(status,503);assert(!body.snapshot);}
delete process.env.RATTERY_SNAPSHOT_URL;await handler({method:"GET",query:{}},res);assert.equal(body.snapshot,null);await handler({method:"POST",query:{}},res);assert.equal(status,405);
const requested:number[]=[];globalThis.fetch=(async(url:any)=>{const chunk=Number(new URL(url,"http://local").searchParams.get("chunk"));requested.push(chunk);return Response.json({ok:true,launched:true,trades:trades.map(t=>({...t,eth:t.eth}))});}) as typeof fetch;
const fetched=await fetchAllHistory(3,{fromChunk:2,afterKey:a.lastKey()});assert.deepEqual(requested,[2,3]);assert.equal(fetched.trades.length,20);
globalThis.fetch=native;
writeFileSync("test-results/snapshot-service-test.json",JSON.stringify({identity,roundtrip:true,resumeMatchesGenesis:true,invalidCases:8,chainAndAnchorGuards:true,remainingChunks:true},null,2));
console.log("PASS: identity/model/checksum, 8 invalid snapshots, resume equivalence, reorg/network/finality guards, remaining chunks and read-only endpoint");
