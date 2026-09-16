import { collectSnapshotBatches } from "./lib/snapshot-batches";
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { buildSnapshot } from "./lib/snapshot-build";
import { collectSnapshotArchive } from "./lib/snapshot-collect";
import { CONFIG } from "../src/config";
const identity={chainId:4663,token:"0x"+"a".repeat(40),birthBlock:100};
const t0=1780000000000,ms=CONFIG.time.tickMs;
const anchor=(block:number,tick:number)=>({block,hash:"0x"+block.toString(16).padStart(64,"0"),timestamp:t0+tick*ms});
const trade=(block:number,logIndex:number,tick:number,wallet=1)=>({block,logIndex,ts:t0+tick*ms,trader:"0x"+wallet.toString(16).padStart(40,"0"),id:`${block}:${logIndex}`,side:logIndex%2?"sell":"buy",eth:0.2,tokens:100});
const chunk=(from:number,to:number,trades:any[])=>({ok:true,launched:true,complete:true,from,to,trades});
const chunks=[chunk(100,109,[trade(100,0,0),trade(108,0,8),trade(109,0,10,2)]),chunk(110,119,[trade(110,0,10,3),trade(110,1,10,2),trade(118,0,18,4)]),chunk(120,129,[])];
const archive=(parts:any[],end=anchor(129,30))=>({scope:"complete-prefix",identity,anchor:end,chunks:parts});
const full=await buildSnapshot(archive(chunks));
const first=await buildSnapshot(archive(chunks.slice(0,1),anchor(109,10)));
assert.equal(first.holders.length,1,"boundary trade stays pending");
const before=JSON.stringify(first);
const tail={...archive(chunks),scope:"complete-tail",previousAnchor:first.anchor};
const resumed=await buildSnapshot(tail,first);
assert.deepEqual(resumed,full,"incremental state/checksum must match genesis");
assert.equal(JSON.stringify(first),before,"input snapshot is immutable");
const middle=await buildSnapshot(archive(chunks.slice(0,2),anchor(119,20)));
const silent=await buildSnapshot({...archive(chunks.slice(1)),scope:"complete-tail",previousAnchor:middle.anchor},middle);
assert.deepEqual(silent,full,"silence advances biology without changing replay result");
const again=await buildSnapshot({...tail,previousAnchor:full.anchor},full);
assert.deepEqual(again,full,"same anchor is idempotent");
const cases:Record<string,(a:any)=>void>={
 scope:a=>a.scope="complete-prefix",
 previousAnchor:a=>a.previousAnchor.hash="0x"+"f".repeat(64),
 identity:a=>a.identity.token="0x"+"b".repeat(40),
 gap:a=>a.chunks.splice(1,1),
 boundary:a=>a.chunks.shift(),
 regression:a=>a.anchor=anchor(109,9),
 incomplete:a=>a.chunks[1].complete=false,
 position:a=>a.chunks[0].trades.push({...a.chunks[0].trades[0],id:"different"}),
 timeOrder:a=>a.chunks[0].trades[1].ts=t0-1,
 future:a=>a.chunks[2].trades.push(trade(129,0,31)),
};
for(const [name,edit] of Object.entries(cases)){
 const invalid=structuredClone(tail);edit(invalid);
 await assert.rejects(()=>buildSnapshot(invalid,first),undefined,name);
}
const report={passed:true,equivalence:["genesis vs incremental","shared timestamp boundary","silent tail","idempotence","input immutable"],rejected:Object.keys(cases),tick:full.cursor.tick,holders:full.holders.length};
writeFileSync("test-results/snapshot-incremental-test.json",JSON.stringify(report,null,2));
console.log(report);

const collectionCases:string[]=[];
function mock(mode="ok"){
 const requested:number[]=[];let reads=0;
 return {requested,io:{api:async(path:string)=>{
  if(path==="/api/chain")return {ok:true,launched:true,chainId:identity.chainId,token:{address:identity.token},feed:{birthBlock:100,chunkBlocks:10}};
  const n=Number(path.split("=")[1]);requested.push(n);
  if(mode==="429")throw new Error("API HTTP 429");
  if(mode==="503")throw new Error("API HTTP 503");
  return {...chunks[n],chunk:n,complete:mode!=="incomplete"};
 },rpc:async(method:string,params:unknown[])=>{
  if(method==="eth_chainId")return mode==="chain"?"0x1":"0x1237";
  if(method==="eth_blockNumber")return mode==="unconfirmed"?"0x6f":"0x85"; // 111 or 133
  const block=Number(params[0]),a=anchor(block,block===109?10:block===119?20:30);
  reads++;
  return {number:"0x"+block.toString(16),hash:mode==="reorg"&&reads>2?"0x"+"f".repeat(64):a.hash,timestamp:"0x"+(a.timestamp/1000).toString(16)};
 }}};
}
const initialIO=mock();
const collected=await collectSnapshotArchive(initialIO.io,identity,undefined,1);
assert.deepEqual(initialIO.requested,[0]);
assert.deepEqual(await buildSnapshot(collected),first);
collectionCases.push("bounded initial collection");
const tailIO=mock();
const collectedTail=await collectSnapshotArchive(tailIO.io,identity,first,3);
assert.deepEqual(await buildSnapshot(collectedTail,first),full);
collectionCases.push("collected incremental equals genesis");
const limited=mock("unconfirmed");
assert.equal(await collectSnapshotArchive(limited.io,identity),null);
assert.deepEqual(limited.requested,[]);
collectionCases.push("unconfirmed chunks not fetched");
for(const mode of ["429","503","incomplete","chain","reorg"]){
 await assert.rejects(()=>collectSnapshotArchive(mock(mode).io,identity,first,3),undefined,mode);
 collectionCases.push(mode+" rejected");
}
await assert.rejects(()=>collectSnapshotArchive(mock().io,identity,first,1),/cannot advance/);
await assert.rejects(()=>collectSnapshotArchive(mock().io,identity,undefined,101),/maxChunks/);
collectionCases.push("insufficient collection budget rejected","excessive budget rejected");
writeFileSync("test-results/snapshot-collector-test.json",JSON.stringify({passed:true,cases:collectionCases},null,2));
console.log({collectionCases});

const idleIO=mock();
const idleRpc=idleIO.io.rpc;
idleIO.io.rpc=async(method,params)=>method==="eth_blockNumber"?"0x71":idleRpc(method,params); // head 113 confirms anchor 109
assert.equal(await collectSnapshotArchive(idleIO.io,identity,first,1),null);
assert.deepEqual(idleIO.requested,[],"No history fetch when no new confirmed chunk exists");
console.log("PASS: caught-up collector returns no update without fetching chunks");

let saved:any=first;
const failing=mock();
const baseApi=failing.io.api;
failing.io.api=async path=>{if(path.endsWith("chunk=1"))throw new Error("API HTTP 503");return baseApi(path);};
await assert.rejects(()=>collectSnapshotBatches({io:failing.io,identity,previous:first,maxChunks:2,rounds:3,save:async next=>{saved=structuredClone(next);}}),/503/);
assert.deepEqual(saved,first,"failed first batch preserves previous snapshot");
let commits=0;
const secondFailure=mock();
const secondApi=secondFailure.io.api;
secondFailure.io.api=async path=>{if(path.endsWith("chunk=2"))throw new Error("API HTTP 503");return secondApi(path);};
await assert.rejects(()=>collectSnapshotBatches({io:secondFailure.io,identity,maxChunks:2,rounds:3,save:async next=>{saved=structuredClone(next);commits++;}}),/503/);
assert.equal(commits,1,"first successful batch persisted before later failure");
assert.deepEqual(saved,middle);
const recovered=await collectSnapshotBatches({io:mock().io,identity,previous:saved,maxChunks:2,rounds:3,save:async next=>{saved=structuredClone(next);}});
assert.equal(recovered.caughtUp,true);
assert.equal(recovered.completed,1);
assert.deepEqual(saved,full,"restart after failure equals uninterrupted full replay");
let requestsAfterSaveFailure=0;
const saveFailureIO=mock();
const originalApi=saveFailureIO.io.api;
saveFailureIO.io.api=async path=>{requestsAfterSaveFailure++;return originalApi(path);};
await assert.rejects(()=>collectSnapshotBatches({io:saveFailureIO.io,identity,maxChunks:2,rounds:3,save:async()=>{throw new Error("disk full");}}),/disk full/);
assert.equal(requestsAfterSaveFailure,3,"disk failure prevents next batch");
await assert.rejects(()=>collectSnapshotBatches({io:mock().io,identity,rounds:0,save:async()=>{}}),/rounds/);
writeFileSync("test-results/snapshot-batches-test.json",JSON.stringify({passed:true,cases:["first batch failure preserves snapshot","later failure retains committed batch","restart equals genesis","caught-up stops","disk failure prevents next fetch","invalid rounds rejected"]},null,2));
console.log("PASS: resumable batches, failures before/after commit, disk failure and deterministic restart");
