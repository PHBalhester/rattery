import {createServer,type IncomingMessage} from 'node:http';
import {digest,type StagingAuth} from './auth.js';
import type {Persistence} from './persistence.js';
export function stagingServer(auth:StagingAuth,service:Persistence){
 const server=createServer(async(req,res)=>{
  res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Content-Type','application/json');res.setHeader('Content-Security-Policy',"default-src 'none'; frame-ancestors 'none'");
  const send=(status:number,data:unknown)=>{res.writeHead(status);res.end(JSON.stringify(data));};
  try{
   if(req.method!=='POST'){res.setHeader('Allow','POST');return send(405,{error:'Method not allowed'});}
   if(req.headers.origin!==auth.origin)return send(403,{error:'Origin rejected'});
   if(req.headers['content-type']!=='application/json')return send(415,{error:'JSON required'});
   // Never trust client-supplied forwarding headers; staging binds loopback only.
   const bucket=digest((req.socket.remoteAddress??'unknown')+':'+Math.floor(Date.now()/60000));
   const count=(await auth.pool.query('INSERT INTO rate_windows(bucket,hits,expires_at) VALUES($1,1,$2) ON CONFLICT(bucket) DO UPDATE SET hits=rate_windows.hits+1 RETURNING hits',[bucket,Date.now()+120000])).rows[0].hits;
   if(count>100){res.setHeader('Retry-After','60');return send(429,{error:'Rate limit'});}
   const data=await body(req),session=parseCookie(req.headers.cookie);
   if(req.url?.startsWith('/care/')){
    const wallet=await auth.wallet(session),walletBucket=digest('wallet:'+wallet+':'+Math.floor(Date.now()/60000));
    const n=(await auth.pool.query('INSERT INTO rate_windows(bucket,hits,expires_at) VALUES($1,1,$2) ON CONFLICT(bucket) DO UPDATE SET hits=rate_windows.hits+1 RETURNING hits',[walletBucket,Date.now()+120000])).rows[0].hits;
    if(n>30){res.setHeader('Retry-After','60');return send(429,{error:'Rate limit'});}
   }
   if(req.url==='/auth/challenge')return send(200,await auth.challenge(data.address));
   if(req.url==='/auth/verify'){
    const token=await auth.verify(data.id,data.message,data.signature);
    res.setHeader('Set-Cookie',cookie(token,auth.origin));return send(200,{authenticated:true});
   }
   if(req.url==='/auth/logout'){await auth.logout(session);res.setHeader('Set-Cookie',cookie('',auth.origin,0));return send(200,{ok:true});}
   if(req.url==='/care/reserve')return send(200,await service.reserve(session,data.requestId,data.ratId,data.action,data.name));
   if(req.url==='/care/finalize')return send(200,await service.finalize(session,data.id,data.hash));
   return send(404,{error:'Not found'});
  }catch(e){const message=(e as Error).message;send(message==='Body too large'?413:message==='Unauthorized'?401:400,{error:'Request rejected'});}
 });
 server.requestTimeout=10000;server.headersTimeout=10000;server.timeout=10000;
 return server;
}
function cookie(token:string,origin:string,age=3600){return 'rattery_session='+token+'; Path=/; HttpOnly; SameSite=Strict; Max-Age='+age+(origin.startsWith('https:')?'; Secure':'');}
function parseCookie(value=''){return value.split(';').map(x=>x.trim()).find(x=>x.startsWith('rattery_session='))?.slice(16)??'';}
async function body(req:IncomingMessage){
 const chunks:Buffer[]=[];let bytes=0;
 for await(const chunk of req){bytes+=chunk.length;if(bytes>8192)throw Error('Body too large');chunks.push(chunk);}
 const data=JSON.parse(Buffer.concat(chunks).toString('utf8'));
 if(!data||typeof data!=='object'||Array.isArray(data))throw Error('Invalid JSON');return data;
}
