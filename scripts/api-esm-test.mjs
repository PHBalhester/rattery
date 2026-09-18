import {spawnSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
const out='test-results/api-esm';
const r=spawnSync(process.execPath,['node_modules/typescript/bin/tsc','-p','api','--noEmit','false','--outDir',out],{stdio:'inherit'});
if(r.status!==0)process.exit(r.status??1);
process.env.RATTERY_CA='';process.env.RATTERY_SNAPSHOT_URL='';
const {default:handler}=await import(pathToFileURL(resolve(out,'api/snapshot.js')).href);
let status,body;const headers={};
await handler({method:'GET'},{setHeader:(k,v)=>headers[k]=v,status:(code)=>{status=code;return {json:value=>body=value}}});
assert.equal(status,200);assert.deepEqual(body,{ok:true,snapshot:null});assert.equal(headers['Cache-Control'],'no-store');
console.log('PASS: compiled Node ESM snapshot endpoint imports and prelaunch response');

const {default:session}=await import(pathToFileURL(resolve(out,'api/session.js')).href);
process.env.RATTERY_AUTH_ENABLED='false';
const response={statusCode:0,setHeader(){},end(value){body=JSON.parse(value);}};
await session({method:'POST',url:'/api/session?op=challenge'},response);
assert.equal(response.statusCode,404);
console.log('PASS: compiled authentication adapter imports and fails closed when disabled');

// A custom staging hostname is explicitly enabled, never inferred from an attacker header.
process.env.VITE_STAGING='true';process.env.RATTERY_AUTH_ENABLED='true';
for(const configured of ['https://attacker.invalid','https://staging.rattery.tech/']){
 process.env.RATTERY_AUTH_ORIGIN=configured;
 await session({method:'POST',url:'/api/session?op=challenge',headers:{host:'staging.rattery.tech'}},response);
 assert.equal(response.statusCode,503);
}
process.env.RATTERY_AUTH_ORIGIN='https://staging.rattery.tech';
for(const host of ['attacker.invalid','staging.rattery.tech.attacker.invalid','staging.rattery.tech:443',undefined]){
 await session({method:'POST',url:'/api/session?op=challenge',headers:{host,'x-forwarded-host':'staging.rattery.tech',origin:'https://staging.rattery.tech'}},response);
 assert.equal(response.statusCode,403);
}
for(const host of ['staging.rattery.tech','rattery-staging.vercel.app']){
 await session({method:'POST',url:'/api/session?op=invalid',headers:{host}},response);
 assert.equal(response.statusCode,404);
}
process.env.RATTERY_AUTH_ORIGIN='https://rattery-staging.vercel.app';
await session({method:'POST',url:'/api/session?op=invalid',headers:{host:'staging.rattery.tech'}},response);
assert.equal(response.statusCode,403);
console.log('PASS: staging domain allowlist, explicit activation and spoofed-host rejection');
