export type ReadRPC=(method:string,params:unknown[])=>Promise<any>;
const READ_METHODS=new Set(['eth_chainId','eth_blockNumber','eth_getBlockByNumber','eth_getLogs','eth_getTransactionByHash','eth_getTransactionReceipt','eth_call']);
export async function boundedJSON(url:string,init:RequestInit={},limit=2_000_000,fetcher:typeof fetch=fetch){
 const response=await fetcher(url,{...init,redirect:'error',signal:AbortSignal.timeout(15000)});
 if(!response.ok){await response.body?.cancel();throw Error('Upstream HTTP '+response.status);}
 const reader=response.body?.getReader();if(!reader)throw Error('Empty upstream response');
 const parts:Uint8Array[]=[];let bytes=0;
 try{for(;;){const {done,value}=await reader.read();if(done)break;bytes+=value.length;if(bytes>limit)throw Error('Upstream response too large');parts.push(value);}}finally{await reader.cancel();}
 const all=new Uint8Array(bytes);let offset=0;for(const part of parts){all.set(part,offset);offset+=part.length;}
 return JSON.parse(new TextDecoder().decode(all));
}
export function readOnlyRPC(endpoint:string,fetcher:typeof fetch=fetch):ReadRPC{
 const u=new URL(endpoint);
 if(u.protocol!=='https:'||u.username||u.password||u.hash)throw Error('RPC requires HTTPS without URL credentials');
 let sequence=0;
 return async(method,params)=>{
  if(!READ_METHODS.has(method))throw Error('Read-only RPC method denied');
  const id=++sequence;
  const body=await boundedJSON(endpoint,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id,method,params})},2_000_000,fetcher);
  if(body?.id!==id||body?.jsonrpc!=='2.0'||body.error||!Object.hasOwn(body,'result'))throw Error('Invalid RPC response');
  return body.result;
 };
}
export function quantity(value:unknown):number{
 if(typeof value!=='string'||!/^0x(?:0|[1-9a-f][0-9a-f]*)$/i.test(value))throw Error('Invalid RPC quantity');
 const n=Number(BigInt(value));if(!Number.isSafeInteger(n)||n<0)throw Error('Unsafe RPC quantity');return n;
}
export const blockTag=(n:number)=>'0x'+n.toString(16);
export const isHash=(v:unknown):v is string=>typeof v==='string'&&/^0x[0-9a-f]{64}$/.test(v);
export const isAddress=(v:unknown):v is string=>typeof v==='string'&&/^0x[0-9a-f]{40}$/.test(v);
