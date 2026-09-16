import assert from 'node:assert/strict';
const base='http://127.0.0.1:8788';const set=(q='')=>fetch(base+'/__fixture?'+q);const read=async(path:string)=>(await fetch(base+path)).json();
try{
 await set('graduated=1');let r=await read('/api/chain');assert(r.ok);assert.equal(r.launch.phase,'graduated');assert.equal(r.launch.progress,1);
 await set('batchRejected=1');r=await read('/api/trades?chunk=0');assert(r.ok&&r.trades.length===4);
 await set('missingTimestamp=1');r=await read('/api/trades?chunk=0');assert.equal(r.ok,false);assert.match(r.error,/timestamp/);
 await set('rpcError=1');r=await read('/api/trades?chunk=0');assert.equal(r.ok,false);
 await set();r=await read('/api/trades?chunk=0');assert(r.ok&&r.trades.length===4);
 console.log('PASS: synthetic graduation, batch fallback, missing timestamp rejection, RPC outage and recovery');
}finally{await set();}
