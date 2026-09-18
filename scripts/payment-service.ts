import {createServer} from 'node:http';
import {timingSafeEqual} from 'node:crypto';
import {isIP} from 'node:net';
import {Pool} from 'pg';
import {StagingAuth} from '../server/auth.js';
import {Persistence} from '../server/persistence.js';
import {stagingHandler} from '../server/http.js';
import {readOnlyRPC} from '../server/market-io.js';
async function main(){
 if(process.env.RATTERY_PAYMENT_MODE!=='production')throw Error('Explicit production mode required');
 const url=new URL(process.env.RATTERY_PAYMENT_DATABASE_URL??'');
 if(!['postgres:','postgresql:'].includes(url.protocol)||url.pathname!=='/rattery_production'||url.search||url.hash)throw Error('Production database required');
 const ca=process.env.RATTERY_PAYMENT_DATABASE_CA,secret=process.env.RATTERY_PAYMENT_SECRET??'';
 if(!ca||! /^[a-f0-9]{64}$/.test(secret))throw Error('TLS and proxy secret required');
 const pool=new Pool({connectionString:url.href,ssl:{rejectUnauthorized:true,ca},max:6,connectionTimeoutMillis:5000,statement_timeout:15000,idle_in_transaction_session_timeout:20000});pool.on('error',()=>{});
 const auth=new StagingAuth(pool,'https://rattery.tech',Date.now,4663),service=new Persistence(pool,auth,'0xc322305e79337300b59ff48389f8c9a1d9e0de76',18,readOnlyRPC(process.env.RATTERY_RPC??''));
 await pool.query('SELECT id FROM colony_state WHERE id=1');
 const handle=stagingHandler(auth,service,req=>{const ip=req.headers['x-rattery-client-ip'];return typeof ip==='string'&&isIP(ip)?ip:'shared';});
 const expected=Buffer.from('Bearer '+secret);
 const server=createServer((req,res)=>{
  if(req.method==='GET'&&req.url==='/health'){res.setHeader('Content-Type','application/json');res.end('{"ok":true}');return;}
  const actual=Buffer.from(req.headers.authorization??'');if(actual.length!==expected.length||!timingSafeEqual(actual,expected)){res.writeHead(401,{'Content-Type':'application/json'});res.end('{"error":"Unauthorized"}');return;}
  void handle(req,res);
 });server.maxHeadersCount=30;server.requestTimeout=10000;server.headersTimeout=10000;server.timeout=60000;
 const port=Number(process.env.PORT??8080);if(!Number.isInteger(port)||port<1||port>65535)throw Error('Invalid port');
 server.listen(port,'0.0.0.0',()=>console.log('Production payment service ready'));
 const stop=()=>{server.close(()=>void pool.end());setTimeout(()=>process.exit(0),25000).unref();};process.once('SIGTERM',stop);process.once('SIGINT',stop);
}
main().catch(()=>{console.error('Payment service unavailable; details withheld');process.exitCode=1});
