import assert from "node:assert/strict";
import { readFileSync,writeFileSync } from "node:fs";
import handler from "../api/trades";
import { buildSnapshot } from "./lib/snapshot-build";
import { collectSnapshotArchive } from "./lib/snapshot-collect";
const read=(name:string)=>JSON.parse(readFileSync("test-results/"+name,"utf8").replace(/^\uFEFF/,""));
const prefix=read("biscotti-snapshot-archive.json"),previous=read("biscotti-snapshot.json");
const c=read("mainnet-biscotti-increment-capture.json"),blocks=read("mainnet-biscotti-increment-blocks.json"),txs=read("mainnet-biscotti-increment-transactions.json");
const original=read("mainnet-biscotti-capture.json");
process.env.RATTERY_CHAIN_ID="4663";process.env.RATTERY_CA=c.token;process.env.RATTERY_BIRTH_BLOCK=String(c.birthBlock);process.env.RATTERY_CHUNK_BLOCKS="100";
const logs=[...original.receipt.logs,...c.logs];
function rpc(method:string,params:any[]):any{
 if(method==="eth_chainId")return "0x1237";
 if(method==="eth_blockNumber")return "0x"+(c.birthBlock+403).toString(16); // bound collection to captured range
 if(method==="eth_getBlockByNumber"){assert(blocks[params[0]],"Uncaptured block");return blocks[params[0]];}
 if(method==="eth_getTransactionByHash"){assert(txs[params[0]],"Uncaptured transaction");return txs[params[0]];}
 if(method==="eth_getLogs"){
  const f=params[0],from=Number(f.fromBlock),to=Number(f.toBlock);
  assert((from>=c.birthBlock-5&&to<=c.birthBlock+5)||(from>=c.birthBlock+200&&to<=c.birthBlock+399),"Uncaptured log range");
  return logs.filter((l:any)=>l.address===f.address&&Number(l.blockNumber)>=from&&Number(l.blockNumber)<=to&&f.topics.every((t:any,i:number)=>t==null||(Array.isArray(t)?t.includes(l.topics[i]):t===l.topics[i])));
 }
 throw new Error("Unexpected RPC "+method);
}
globalThis.fetch=(async(_url:any,options:any)=>{
 const q=JSON.parse(options.body),one=(x:any)=>({jsonrpc:"2.0",id:x.id,result:rpc(x.method,x.params)});
 return Response.json(Array.isArray(q)?q.map(one):one(q));
}) as typeof fetch;
const requested:number[]=[];
const archive=await collectSnapshotArchive({rpc:async(m,p)=>rpc(m,p),api:async path=>{
 if(path==="/api/chain")return {ok:true,launched:true,chainId:4663,token:{address:c.token},feed:{birthBlock:c.birthBlock,chunkBlocks:100}};
 const n=Number(path.split("=")[1]);requested.push(n);
 if(n<2)return prefix.chunks[n];
 let body:any;const res:any={setHeader(){},status(){return res},json(value:any){body=value;},end(){}};
 await handler({method:"GET",query:{chunk:String(n)}},res);assert(body.ok,body.error);return body;
}},prefix.identity,previous,10);
assert(archive);
const resumed=await buildSnapshot(archive,previous);
const fullArchive={...archive,scope:"complete-prefix",chunks:[...prefix.chunks,...archive.chunks.filter((x:any)=>x.from>prefix.anchor.block)]};
const full=await buildSnapshot(fullArchive);
assert.deepEqual(resumed,full,"Real incremental snapshot differs from full replay");
assert(resumed.cursor.tick>previous.cursor.tick);
writeFileSync("test-results/biscotti-snapshot-400.json",JSON.stringify(resumed));
writeFileSync("test-results/biscotti-snapshot-archive-400.json",JSON.stringify(fullArchive));
const report={passed:true,capturedAt:c.capturedAt,scope:"First 400 blocks, not current colony",previousAnchor:previous.anchor,newAnchor:resumed.anchor,previousTick:previous.cursor.tick,newTick:resumed.cursor.tick,requestedChunks:requested,newTrades:archive.chunks.filter((x:any)=>x.from>prefix.anchor.block).reduce((n:number,x:any)=>n+x.trades.length,0),holders:resumed.holders.length,equivalentChecksum:full.checksum===resumed.checksum};
writeFileSync("test-results/snapshot-real-increment-test.json",JSON.stringify(report,null,2));console.log(report);
