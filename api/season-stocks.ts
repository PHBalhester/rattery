import type {IncomingMessage,ServerResponse} from 'node:http';
import {rpc} from './_lib/eth.js';
import {stockFeed} from './_lib/seasonStocks.js';
let cached:Awaited<ReturnType<typeof stockFeed>>|null=null,pending:Promise<Awaited<ReturnType<typeof stockFeed>>>|null=null;
export const config={maxDuration:60};
export default async function handler(req:IncomingMessage,res:ServerResponse){
 res.setHeader('Content-Type','application/json');res.setHeader('X-Content-Type-Options','nosniff');
 if(req.method!=='GET'){res.setHeader('Allow','GET');res.statusCode=405;res.end(JSON.stringify({error:'Method not allowed'}));return;}
 try{if(!cached||Date.now()-cached.asOf>60000){if(!pending)pending=stockFeed(rpc).finally(()=>{pending=null;});cached=await pending;}
 res.setHeader('Cache-Control','public, max-age=0, s-maxage=30');res.end(JSON.stringify(cached));
 }catch{res.setHeader('Cache-Control','no-store');res.statusCode=503;res.end(JSON.stringify({error:'Stock prices temporarily unavailable'}));}
}