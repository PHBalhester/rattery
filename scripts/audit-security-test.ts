import assert from 'node:assert/strict';
import {parseBlock} from '../api/_lib/eth';
import handler from '../api/chain';
import {fetchChain} from '../src/market/chain';
for(const bad of ['0x12junk','1.5','Infinity','9007199254740992','-1','1e3'])assert.equal(parseBlock(bad),null);
assert.equal(parseBlock('0x10'),16);assert.equal(parseBlock('0'),0);
const original=globalThis.fetch;let signal=false,dec='0x0';
process.env.RATTERY_CA='0x1111111111111111111111111111111111111111';process.env.RATTERY_CURVE='0x2222222222222222222222222222222222222222';process.env.RATTERY_BIRTH_BLOCK='0';process.env.RATTERY_CHAIN_ID='4663';process.env.RATTERY_RPC='https://fixture.invalid';
const response=(v:unknown)=>new Response(JSON.stringify(v),{headers:{'content-type':'application/json'}});
function res(){const out:any={headers:{}};const r:any={setHeader:(k:string,v:string)=>out.headers[k]=v,status:(n:number)=>{out.status=n;return r},json:(v:unknown)=>out.body=v,end:()=>{}};return {out,r};}
try{
 globalThis.fetch=async (url,opts)=>{
  if(String(url).includes('/api/v2/')){assert(opts?.signal);return response({holders_count:-3});}
  const q=JSON.parse(String(opts?.body));const one=(q:any)=>({id:q.id,jsonrpc:'2.0',result:q.method==='eth_chainId'?'0x1237':q.method==='eth_getLogs'?[]:q.method==='eth_blockNumber'?'0x10':q.params?.[0]?.data==='0x313ce567'?dec:q.params?.[0]?.data==='0x18160ddd'?'0x64':'0x0'});
  return response(Array.isArray(q)?q.map(one):one(q));
 };
 let f=res();await handler({method:'POST',query:{}},f.r);assert.equal(f.out.status,405);
 f=res();await handler({method:'GET',query:{}},f.r);assert.equal(f.out.body.ok,true);assert.equal(f.out.body.token.decimals,0);assert.equal(f.out.body.token.supply,100);assert.equal(f.out.body.token.holders,null);
 for(dec of ['0xffffffffff','0x0junk']){f=res();await handler({method:'GET',query:{}},f.r);assert.equal(f.out.body.ok,false);}
 let body:any={ok:true,launched:false,chainId:4663,updated:0,links:{site:'javascript:alert(1)',x:'https://x.com/ratterytech'}};
 globalThis.fetch=async (_url,opts)=>{signal=!!opts?.signal;return response(body)};
 let c=await fetchChain();assert(c.ok);assert.equal(c.links.site,'https://rattery.tech');assert(signal);
 for(body of [null,{}, {...body,chainId:1},{...body,launched:true,feed:{birthBlock:0,chunkBlocks:0,headChunk:0}}])assert.equal((await fetchChain()).ok,false);
 console.log('PASS: strict block parsing, read-only method guard, zero/hostile decimals, negative holders, request deadlines, invalid live metadata and unsafe links');
}finally{globalThis.fetch=original;}
