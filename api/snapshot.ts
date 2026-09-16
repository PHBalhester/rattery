declare const process: { env: Record<string,string|undefined> };
import { ENV, rpc, type Req, type Res } from "./_lib/eth.js";
import { MAX_SNAPSHOT_BYTES, validateSnapshot } from "../src/sim/snapshot.js";

/** Read-only endpoint. Only a deployment-configured, trusted publisher is used. */
export default async function handler(req: Req, res: Res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "GET") return res.status(405).json({ok:false,error:"GET required"});
  const source = process.env.RATTERY_SNAPSHOT_URL;
  if (!source || !ENV.ca || ENV.birthBlock === null) return res.status(200).json({ok:true,snapshot:null});
  try {
    const url = new URL(source);
    if (url.protocol !== "https:" && !(url.protocol === "http:" && ["localhost","127.0.0.1"].includes(url.hostname))) throw new Error("Snapshot source must use HTTPS");
    const response = await fetch(url,{signal:AbortSignal.timeout(15000),redirect:"error"});
    if (!response.ok) throw new Error("Snapshot source unavailable");
    if (Number(response.headers.get("content-length")) > MAX_SNAPSHOT_BYTES) throw new Error("Snapshot too large");
    const reader=response.body?.getReader();if(!reader)throw new Error("Missing snapshot body");
    const parts:Uint8Array[]=[];let size=0;
    for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>MAX_SNAPSHOT_BYTES){await reader.cancel();throw new Error("Snapshot too large");}parts.push(value);}
    const bytes=new Uint8Array(size);let offset=0;for(const p of parts){bytes.set(p,offset);offset+=p.length;}
    const snapshot=await validateSnapshot(JSON.parse(new TextDecoder().decode(bytes)),{chainId:ENV.chainId,token:ENV.ca,birthBlock:ENV.birthBlock});
    if (Number(await rpc<string>("eth_chainId",[])) !== ENV.chainId) throw new Error("Snapshot RPC chain mismatch");
    const head=Number(await rpc<string>("eth_blockNumber",[]));
    if (snapshot.anchor.block > head-4) throw new Error("Snapshot anchor is not confirmed");
    const block=await rpc<{hash:string;timestamp:string}|null>("eth_getBlockByNumber",["0x"+snapshot.anchor.block.toString(16),false]);
    if (!block || block.hash?.toLowerCase()!==snapshot.anchor.hash || Number(block.timestamp)*1000!==snapshot.anchor.timestamp) throw new Error("Snapshot anchor changed");
    return res.status(200).json({ok:true,snapshot});
  } catch(error) {return res.status(503).json({ok:false,error:String((error as Error).message).slice(0,160)});}
}
