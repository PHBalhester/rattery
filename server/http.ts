import {createServer,type IncomingMessage,type ServerResponse} from 'node:http';
import {randomBytes} from 'node:crypto';
import {digest,type StagingAuth} from './auth.js';
import type {Persistence} from './persistence.js';
export function stagingHandler(auth:StagingAuth,service:Persistence|null,clientIP=(req:IncomingMessage)=>req.socket.remoteAddress??'unknown'){
 return async(req:IncomingMessage,res:ServerResponse)=>{
  res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Content-Type','application/json');res.setHeader('Content-Security-Policy',"default-src 'none'; frame-ancestors 'none'");
  const send=(status:number,data:unknown)=>{res.writeHead(status);res.end(JSON.stringify(data));};
  try{
   if(req.method!=='POST'){res.setHeader('Allow','POST');return send(405,{error:'Method not allowed'});}
   if(req.headers.origin!==auth.origin)return send(403,{error:'Origin rejected'});
   if(req.headers['content-type']!=='application/json')return send(415,{error:'JSON required'});
   // Socket identity by default; the deployment adapter supplies a trusted proxy identity.
   const globalBucket='global:'+Math.floor(Date.now()/60000);
   const globalCount=(await auth.pool.query('INSERT INTO rate_windows(bucket,hits,expires_at) VALUES($1,1,$2) ON CONFLICT(bucket) DO UPDATE SET hits=rate_windows.hits+1 RETURNING hits',[globalBucket,Date.now()+120000])).rows[0].hits;
   if(globalCount>1000){res.setHeader('Retry-After','60');return send(429,{error:'Rate limit'});}
   if(globalCount%20===1)await auth.pool.query('WITH c AS (DELETE FROM auth_challenges WHERE id IN (SELECT id FROM auth_challenges WHERE expires_at<$1 LIMIT 100)), s AS (DELETE FROM auth_sessions WHERE digest IN (SELECT digest FROM auth_sessions WHERE expires_at<$1 LIMIT 100)) DELETE FROM rate_windows WHERE bucket IN (SELECT bucket FROM rate_windows WHERE expires_at<$1 LIMIT 100)',[Date.now()]);
   const bucket=digest(clientIP(req)+':'+Math.floor(Date.now()/60000));
   const count=(await auth.pool.query('INSERT INTO rate_windows(bucket,hits,expires_at) VALUES($1,1,$2) ON CONFLICT(bucket) DO UPDATE SET hits=rate_windows.hits+1 RETURNING hits',[bucket,Date.now()+120000])).rows[0].hits;
   if(count>100){res.setHeader('Retry-After','60');return send(429,{error:'Rate limit'});}
   const data=await body(req),session=parseCookie(req.headers.cookie);
   if(req.url==='/auth/session'){
    let wallet:string|null=null;try{wallet=await auth.wallet(session);}catch{/* Anonymous or expired. */}
    return send(200,{wallet,chainId:46630,paymentsEnabled:service!==null});
   }
   if(req.url?.startsWith('/care/')&&!service)return send(503,{error:'Payments disabled'});
   if(req.url?.startsWith('/care/')){
    const wallet=await auth.wallet(session),walletBucket=digest('wallet:'+wallet+':'+Math.floor(Date.now()/60000));
    const n=(await auth.pool.query('INSERT INTO rate_windows(bucket,hits,expires_at) VALUES($1,1,$2) ON CONFLICT(bucket) DO UPDATE SET hits=rate_windows.hits+1 RETURNING hits',[walletBucket,Date.now()+120000])).rows[0].hits;
    if(n>30){res.setHeader('Retry-After','60');return send(429,{error:'Rate limit'});}
   }
   if(req.url==='/auth/challenge'){
    if(typeof data.address!=='string'||!/^0x[0-9a-fA-F]{40}$/.test(data.address))return send(400,{error:'Invalid address'});
    const k=digest('challenge:'+data.address.toLowerCase()+':'+Math.floor(Date.now()/60000));
    const n=(await auth.pool.query('INSERT INTO rate_windows(bucket,hits,expires_at) VALUES($1,1,$2) ON CONFLICT(bucket) DO UPDATE SET hits=rate_windows.hits+1 RETURNING hits',[k,Date.now()+120000])).rows[0].hits;
    if(n>5)return send(429,{error:'Rate limit'});
    const c=await auth.challenge(data.address);
    const binding=randomBytes(32).toString('hex');
    await auth.pool.query('UPDATE auth_challenges SET browser_digest=$2 WHERE id=$1',[c.id,digest(binding)]);
    res.setHeader('Set-Cookie',challengeCookie(binding,auth.origin));return send(200,c);
   }
   if(req.url==='/auth/verify'){
    const binding=parseCookie(req.headers.cookie,'rattery_challenge');
    if(!data.id||! /^[0-9a-f]{64}$/.test(binding))return send(403,{error:'Challenge cookie required'});
    const bound=(await auth.pool.query('SELECT id FROM auth_challenges WHERE id=$1 AND browser_digest=$2',[data.id,digest(binding)])).rows[0];
    if(!bound)return send(403,{error:'Challenge cookie required'});
    const token=await auth.verify(data.id,data.message,data.signature);
    await auth.logout(session);
    res.setHeader('Set-Cookie',[cookie(token,auth.origin),challengeCookie('',auth.origin,0)]);return send(200,{authenticated:true});
   }
   if(req.url==='/auth/logout'){await auth.logout(session);res.setHeader('Set-Cookie',cookie('',auth.origin,0));return send(200,{ok:true});}
   if(req.url==='/care/overview')return send(200,await service!.overview(session));
   if(req.url==='/care/begin')return send(200,await service!.beginSubmission(session,data.id));
   if(req.url==='/care/submitted')return send(200,await service!.rememberSubmission(session,data.id,data.hash));
   if(req.url==='/care/reserve')return send(200,await service!.reserve(session,data.requestId,data.ratId,data.action,data.name));
   if(req.url==='/care/finalize')return send(200,await service!.finalize(session,data.id,data.hash));
   return send(404,{error:'Not found'});
  }catch(e){const message=(e as Error).message;send(message==='Body too large'?413:message==='Unauthorized'?401:400,{error:'Request rejected'});}
 };
}
export function stagingServer(auth:StagingAuth,service:Persistence|null){
 const server=createServer(stagingHandler(auth,service));
 server.requestTimeout=10000;server.headersTimeout=10000;server.timeout=10000;
 return server;
}
function cookie(token:string,origin:string,age=3600){return 'rattery_session='+token+'; Path=/; HttpOnly; SameSite=Strict; Max-Age='+age+(origin.startsWith('https:')?'; Secure':'');}
function challengeCookie(value:string,origin:string,age=300){return cookie(value,origin,age).replace('rattery_session=','rattery_challenge=');}
function parseCookie(value='',name='rattery_session'){return value.split(';').map(x=>x.trim()).find(x=>x.startsWith(name+'='))?.slice(name.length+1)??'';}
async function body(req:IncomingMessage){
 const parsed=(req as IncomingMessage&{body?:unknown}).body;
 if(parsed!==undefined){
  if(Buffer.byteLength(typeof parsed==='string'?parsed:JSON.stringify(parsed))>8192)throw Error('Body too large');
  const data=typeof parsed==='string'?JSON.parse(parsed):parsed;
  if(!data||typeof data!=='object'||Array.isArray(data))throw Error('Invalid JSON');return data as Record<string,any>;
 }
 const chunks:Buffer[]=[];let bytes=0;
 for await(const chunk of req){bytes+=chunk.length;if(bytes>8192)throw Error('Body too large');chunks.push(chunk);}
 const data=JSON.parse(Buffer.concat(chunks).toString('utf8'));
 if(!data||typeof data!=='object'||Array.isArray(data))throw Error('Invalid JSON');return data;
}
