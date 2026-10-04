import type {IncomingMessage,ServerResponse} from 'node:http';
import {rpc} from './_lib/eth.js';
import {seasonResult} from './_lib/seasonResult.js';
import {closingReferences} from './_lib/seasonClosingReferences.js';
export const config={maxDuration:60};
let cache:Awaited<ReturnType<typeof seasonResult>>|null=null,pending:Promise<Awaited<ReturnType<typeof seasonResult>>>|null=null;
export default async function handler(req:IncomingMessage,res:ServerResponse){
 res.setHeader('Content-Type','application/json');res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
 if(req.method!=='GET'){res.setHeader('Allow','GET');res.statusCode=405;res.end(JSON.stringify({error:'Method not allowed'}));return;}
 try{
  if(!cache||Date.now()-cache.serverAt>5000){if(!pending)pending=seasonResult(rpc,closingReferences).finally(()=>{pending=null;});cache=await pending;}
  res.end(JSON.stringify(cache));
 }catch{res.statusCode=503;res.end(JSON.stringify({error:'Result verification temporarily unavailable'}));}
}
