import { validateSnapshot, type ColonySnapshot, type SnapshotIdentity } from "../../src/sim/snapshot";
export type CollectionIO={api:(path:string)=>Promise<any>;rpc:(method:string,params:unknown[])=>Promise<any>};
export async function collectSnapshotArchive(io:CollectionIO,identity:SnapshotIdentity,previous?:ColonySnapshot,maxChunks=10){
 if(!Number.isSafeInteger(maxChunks)||maxChunks<1||maxChunks>100)throw new Error("maxChunks must be 1..100");
 const prior=previous?await validateSnapshot(previous,identity):null;
 const meta=await io.api("/api/chain");
 if(!meta.ok||!meta.launched||meta.chainId!==identity.chainId||meta.token?.address?.toLowerCase()!==identity.token||meta.feed?.birthBlock!==identity.birthBlock)throw new Error("API identity mismatch");
 const size=meta.feed.chunkBlocks;
 if(!Number.isSafeInteger(size)||size<1)throw new Error("Invalid chunk size");
 if(Number(await io.rpc("eth_chainId",[]))!==identity.chainId)throw new Error("RPC chain mismatch");
 const head=Number(await io.rpc("eth_blockNumber",[]));
 if(!Number.isSafeInteger(head)||head<identity.birthBlock)throw new Error("Invalid RPC head");
 const readAnchor=async(block:number)=>{
  const raw=await io.rpc("eth_getBlockByNumber",["0x"+block.toString(16),false]);
  const timestamp=Number(raw?.timestamp)*1000;
  if(Number(raw?.number)!==block||!/^0x[0-9a-f]{64}$/.test(raw?.hash)||!Number.isSafeInteger(timestamp)||timestamp<=0)throw new Error("Invalid RPC anchor");
  return {block,hash:raw.hash,timestamp};
 };
 const verify=async(expected:any)=>{const actual=await readAnchor(expected.block);if(actual.hash!==expected.hash||actual.timestamp!==expected.timestamp)throw new Error("Anchor changed; collection aborted");};
 if(prior){if(prior.anchor.block>head-4)throw new Error("Previous anchor unconfirmed");await verify(prior.anchor);}
 const boundary=prior&&prior.cursor.lastKey>=0?Math.floor(prior.cursor.lastKey/100000):identity.birthBlock;
 const start=Math.floor((boundary-identity.birthBlock)/size);
 const lastConfirmed=Math.floor((head-4-identity.birthBlock+1)/size)-1;
 if(prior&&identity.birthBlock+(lastConfirmed+1)*size-1<=prior.anchor.block)return null;
 const end=Math.min(lastConfirmed,start+maxChunks-1);
 if(end<start)return null;
 const finalBlock=identity.birthBlock+(end+1)*size-1;
 if(prior&&finalBlock<=prior.anchor.block)throw new Error("Collection limit cannot advance previous anchor; increase maxChunks");
 const anchor=await readAnchor(finalBlock),chunks=[];
 for(let n=start;n<=end;n++){
  const chunk=await io.api(`/api/trades?chunk=${n}`);
  if(!chunk.ok||!chunk.launched||!chunk.complete||chunk.chunk!==n||chunk.from!==identity.birthBlock+n*size||chunk.to!==identity.birthBlock+(n+1)*size-1||!Array.isArray(chunk.trades))throw new Error("Missing or incomplete collection chunk");
  chunks.push(chunk);
 }
 if(prior)await verify(prior.anchor);
 await verify(anchor);
 return {scope:prior?"complete-tail":"complete-prefix",identity,previousAnchor:prior?.anchor,anchor,chunks};
}
