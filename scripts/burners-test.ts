// Top-burner leaderboard: read-only SQL aggregation, observer route (auth, cache, errors) and the public API proxy.
// SQL part needs an isolated Postgres database ending in _test (PGDATABASE or RATTERY_TEST_DATABASE_URL); it is skipped otherwise.
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {readFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {Pool} from 'pg';
import {observerServer,readBurners} from '../server/observer';
import handler from '../api/burners';

const A='0x'+'a'.repeat(40),B='0x'+'b'.repeat(40),C='0x'+'c'.repeat(40),E=18n;
const units=(n:number)=>(BigInt(n)*10n**E).toString();

// 1) SQL aggregation on a real database
const connectionString=process.env.RATTERY_TEST_DATABASE_URL,database=connectionString?decodeURIComponent(new URL(connectionString).pathname.slice(1)):process.env.PGDATABASE;
if(database?.endsWith('_test')){
 const connection=connectionString?{connectionString,ssl:{rejectUnauthorized:true}}:{};
 const admin=new Pool(connection),schema='test_'+randomUUID().replaceAll('-','');await admin.query('CREATE SCHEMA '+schema);
 const db=new Pool({...connection,options:'-c search_path='+schema});
 try{
  await db.query(readFileSync('server/migrations/005_trade_ledger.sql','utf8'));await db.query(readFileSync('server/migrations/012_burn_support.sql','utf8'));
  await db.query("INSERT INTO trade_stream(id,chain_id,token,last_block,last_hash,last_timestamp) VALUES(1,4663,'0xC322305e79337300b59fF48389f8C9A1D9E0de76',30,$1,0)",['0x'+'1'.repeat(64)]);
  for(const b of [10,20,30])await db.query('INSERT INTO trade_blocks VALUES($1,$2,$3)',[b,'0x'+String(b).padStart(64,'0'),'f']);
  const burn=(id:string,block:number,log:number,from:string,n:number)=>db.query('INSERT INTO colony_burns(identity,block_number,log_index,raw,available_at) VALUES($1,$2,$3,$4,0)',[id,block,log,{chainId:4663,token:'0xc322',hash:'0x'+id.padStart(64,'0'),logIndex:log,timestamp:0,from,units:units(n)}]);
  await burn('1',10,0,A,500000);await burn('2',20,0,B.toUpperCase().replace('0X','0x'),700000);await burn('3',20,1,B,100000);await burn('4',30,0,C,50);await burn('5',30,1,A,300000);
  const r=await readBurners(db,2);
  assert.equal(r.kind,'burners');assert.equal(r.chainId,4663);assert.equal(r.token,'0xc322305e79337300b59ff48389f8c9a1d9e0de76');
  assert.equal(r.totalUnits,units(1600050));assert.equal(r.burns,5);assert.equal(r.wallets,3,'Mixed-case addresses are one wallet');
  assert.equal(r.firstBlock,10);assert.equal(r.lastBlock,30);
  assert.deepEqual(r.leaders.map(l=>[l.wallet,l.units,l.burns,l.nest]),[[A,units(800000),2,null],[B,units(800000),2,null]],'Sorted by amount, ties by address, limited');
  await assert.rejects(()=>readBurners(db,0));await assert.rejects(()=>readBurners(db,1000));
  const empty=new Pool({...connection,options:'-c search_path='+schema});await empty.query('DELETE FROM colony_burns');
  const none=await readBurners(empty);assert.equal(none.totalUnits,'0');assert.deepEqual(none.leaders,[]);await empty.end();
  console.log('PASS readBurners SQL aggregation');
 }finally{await db.end();await admin.query('DROP SCHEMA '+schema+' CASCADE');await admin.end();}
}else console.log('SKIP readBurners SQL (set PGDATABASE=..._test)');

// 2) Observer route: auth, coalesced cache, failure without leaking details, route disabled when not configured
let reads=0,now=100000,fail=false;const secret='b'.repeat(64);
const board={protocol:1,kind:'burners',chainId:4663,at:now,totalUnits:units(10),burns:1,wallets:1,firstBlock:1,lastBlock:1,leaders:[{wallet:A,units:units(10),burns:1,nest:null}]};
const server=observerServer(async()=>({protocol:1}),secret,()=>now,async()=>{reads++;await new Promise(r=>setTimeout(r,20));if(fail)throw Error('PRIVATE_DATABASE_URL');return board;});
server.listen(0,'127.0.0.1');await once(server,'listening');const port=(server.address() as any).port,url=`http://127.0.0.1:${port}/burners`,auth={Authorization:'Bearer '+secret};
try{
 assert.equal((await fetch(url)).status,401);assert.equal(reads,0);
 assert.equal((await fetch(url,{method:'POST',headers:auth})).status,405);
 const many=await Promise.all(Array.from({length:10},()=>fetch(url,{headers:auth})));assert(many.every(r=>r.status===200));assert.equal(reads,1,'Coalesce concurrent reads');
 now+=10000;await fetch(url,{headers:auth});assert.equal(reads,1,'Cached for 30 s');
 now+=30000;fail=true;const bad=await fetch(url,{headers:auth});assert.equal(bad.status,503);assert(!(await bad.text()).includes('PRIVATE'));
}finally{server.closeAllConnections();await new Promise<void>(r=>server.close(()=>r()));}
const plain=observerServer(async()=>({}),secret);plain.listen(0,'127.0.0.1');await once(plain,'listening');
try{assert.equal((await fetch(`http://127.0.0.1:${(plain.address() as any).port}/burners`,{headers:auth})).status,404,'No route without a reader');}finally{plain.closeAllConnections();await new Promise<void>(r=>plain.close(()=>r()));}
console.log('PASS observer /burners route');

// 3) Public API proxy: config gate, strict validation, no browser-controlled URL
const nativeFetch=globalThis.fetch,env={...process.env};let upstream:any=board,calledUrl='';
const invoke=async(method='GET')=>{let code=200,body:any;const headers:Record<string,string>={};await handler({method,query:{url:'https://evil.invalid'}} as any,{setHeader:(k:string,v:string)=>{headers[k]=v;},status(n:number){code=n;return this;},json(v:any){body=v;},end(){}} as any);return {code,body,headers};};
try{
 delete process.env.RATTERY_OBSERVER_ENABLED;assert.equal((await invoke()).code,503);
 Object.assign(process.env,{RATTERY_PUBLIC_COLONY:'production',RATTERY_OBSERVER_ENABLED:'true',RATTERY_OBSERVER_URL:'https://observer-x.up.railway.app/snapshot',RATTERY_OBSERVER_SECRET:secret});
 globalThis.fetch=(async(u:any,init:any)=>{calledUrl=String(u);assert.equal(init.headers.Authorization,'Bearer '+secret);assert.equal(init.redirect,'error');return new Response(JSON.stringify(upstream),{headers:{'content-type':'application/json'}});}) as any;
 let r=await invoke();assert.equal(r.code,200);assert.equal(calledUrl,'https://observer-x.up.railway.app/burners');assert.equal(r.body.leaders[0].wallet,A);assert.match(r.headers['Cache-Control'],/s-maxage=30/);
 assert.equal((await invoke('POST')).code,405);
 for(const broken of [{...board,leaders:[{wallet:'0xnot',units:'1',burns:1,nest:null}]},{...board,leaders:[{wallet:A,units:'-1',burns:1,nest:null}]},{...board,leaders:[{wallet:A,units:'1',burns:1,nest:'<script>'}]},{...board,totalUnits:'1e9'},{...board,kind:'snapshot'}]){upstream=broken;assert.equal((await invoke()).code,503,'Rejects '+JSON.stringify(broken).slice(0,80));}
 upstream=board;process.env.RATTERY_OBSERVER_URL='https://evil.example/snapshot';assert.equal((await invoke()).code,503,'Only Railway observer hosts');
}finally{globalThis.fetch=nativeFetch;process.env=env;}
console.log('PASS /api/burners proxy');
