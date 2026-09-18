/** Authenticated same-origin proxy. Database credentials stay inside Railway. */
import type {IncomingMessage,ServerResponse} from 'node:http';
import {isIP} from 'node:net';
import {body} from '../server/http.js';
const operations=new Set(['auth/challenge','auth/verify','auth/session','auth/logout','care/overview','care/reserve','care/begin','care/submitted','care/finalize','care/cancel']);
export default async function handler(req:IncomingMessage,res:ServerResponse){
 res.setHeader('Cache-Control','no-store');res.setHeader('Content-Type','application/json');res.setHeader('X-Content-Type-Options','nosniff');
 const fail=(status:number)=>{res.statusCode=status;res.end(JSON.stringify({error:'Payment service unavailable'}));};
 if(process.env.RATTERY_PAYMENTS_ENABLED!=='true'||process.env.VERCEL!=='1'||process.env.VITE_STAGING==='true')return fail(503);
 if(req.headers.host!=='rattery.tech'||req.headers.origin!=='https://rattery.tech')return fail(403);
 if(req.method!=='POST')return fail(405);
 if(req.headers['content-type']!=='application/json')return fail(415);
 const op=new URL(req.url??'','https://internal.invalid').searchParams.get('op');if(!op||!operations.has(op))return fail(404);
 try{
  const base=new URL(process.env.RATTERY_PAYMENT_URL??''),secret=process.env.RATTERY_PAYMENT_SECRET??'';
  if(base.protocol!=='https:'||!base.hostname.endsWith('.up.railway.app')||base.pathname!=='/'||base.search||base.hash||base.username||base.password||! /^[a-f0-9]{64}$/.test(secret))throw Error('Invalid upstream');
  const ip=req.headers['x-vercel-forwarded-for'];
  const upstream=await fetch(new URL(op,base),{method:'POST',redirect:'error',headers:{'Content-Type':'application/json',Authorization:'Bearer '+secret,Origin:'https://rattery.tech',Cookie:req.headers.cookie??'','X-Rattery-Client-IP':typeof ip==='string'&&isIP(ip)?ip:'shared'},body:JSON.stringify(await body(req)),signal:AbortSignal.timeout(45000)});
  const reader=upstream.body?.getReader();if(!reader||!upstream.headers.get('content-type')?.includes('application/json'))throw Error('Invalid upstream response');let size=0;const chunks:Uint8Array[]=[];
  for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>512000){await reader.cancel();throw Error('Response too large');}chunks.push(value);}
  const cookies=upstream.headers.getSetCookie();if(cookies.length)res.setHeader('Set-Cookie',cookies);
  const retry=upstream.headers.get('retry-after');if(retry&&/^\d{1,4}$/.test(retry))res.setHeader('Retry-After',retry);
  res.statusCode=upstream.status;res.end(Buffer.concat(chunks));
 }catch(e){if(!res.headersSent)fail((e as Error).message==='Body too large'?413:503);else res.end();}
}
