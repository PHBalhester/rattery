import {spawnSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
const out='test-results/server-esm';
const r=spawnSync(process.execPath,['node_modules/typescript/bin/tsc','-p','server','--noEmit','false','--outDir',out],{stdio:'inherit'});
if(r.status!==0)process.exit(r.status??1);
for(const [file,name] of [['trade-ledger','TradeLedger'],['auth','StagingAuth'],['persistence','Persistence'],['http','stagingServer'],['simulation-worker','startSimulationWorker']]){
 const module=await import(pathToFileURL(resolve(out,'server',file+'.js')).href);
 assert.equal(typeof module[name],'function');
}
console.log('PASS: compiled Node ESM staging modules load without extension resolution errors');
