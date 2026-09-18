/** Staging-only SIWE adapter. No burn/mint route is activated here. */
import type {IncomingMessage,ServerResponse} from 'node:http';
import {isIP} from 'node:net';
import {Pool} from 'pg';
import {StagingAuth} from '../server/auth.js';
import {stagingHandler} from '../server/http.js';
const handles=new Map<string,ReturnType<typeof stagingHandler>>();
export default async function handler(req:IncomingMessage,res:ServerResponse){
 res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
 res.setHeader('Content-Type','application/json');
 const fail=(status:number)=>{res.statusCode=status;res.end(JSON.stringify({error:'Authentication unavailable'}));};
 if(process.env.VITE_STAGING!=='true'||process.env.RATTERY_AUTH_ENABLED!=='true')return fail(404);
 const configured=process.env.RATTERY_AUTH_ORIGIN;
 const legacy='https://rattery-staging.vercel.app',custom='https://staging.rattery.tech';
 if(configured!==legacy&&configured!==custom)return fail(503);
 // Only explicit deployment hostnames may select a SIWE origin. Never trust
 // forwarded-host or arbitrary Origin headers to construct signed messages.
 const allowed=configured===custom?[legacy,custom]:[legacy];
 const origin=allowed.find(value=>new URL(value).host===req.headers?.host);
 if(!origin)return fail(403);
 const op=new URL(req.url??'','https://internal.invalid').searchParams.get('op');
 if(!['challenge','verify','logout','session'].includes(op??''))return fail(404);
 try{
  let handle=handles.get(origin);
  if(!handle){
   const url=new URL(process.env.RATTERY_AUTH_DATABASE_URL??'');
   if(url.pathname!=='/rattery_staging_auth'||!url.hostname.endsWith('.neon.tech')||url.search)throw Error('Invalid database');
   const pool=new Pool({connectionString:url.href,ssl:{rejectUnauthorized:true},max:3,connectionTimeoutMillis:5000,idleTimeoutMillis:10000,statement_timeout:5000});
   pool.on('error',()=>{/* Do not log connection information. */});
   const auth=new StagingAuth(pool,origin);
   handle=stagingHandler(auth,null,(request)=>{
    // Vercel overwrites this header. Never use this adapter outside Vercel.
    const ip=request.headers['x-vercel-forwarded-for'];
    return process.env.VERCEL==='1'&&typeof ip==='string'&&isIP(ip)?ip:'shared';
   });
  }
  handles.set(origin,handle);
  req.url='/auth/'+op;
  await handle(req,res);
 }catch{if(!res.headersSent)fail(503);else res.end();}
}
