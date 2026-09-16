import assert from "node:assert/strict";
import {readFileSync,writeFileSync} from "node:fs";
import {spawnSync} from "node:child_process";
import {validateSnapshot} from "../src/sim/snapshot";
const archive=JSON.parse(readFileSync("test-results/biscotti-snapshot-archive.json","utf8").replace(/^\uFEFF/,""));
const run=(input:string,output:string)=>spawnSync("npx",["--yes","tsx","scripts/build-snapshot.ts",input,output],{encoding:"utf8"});
const good=run("test-results/biscotti-snapshot-archive.json","test-results/biscotti-snapshot.json");assert.equal(good.status,0,good.stderr);
const snapshot=JSON.parse(readFileSync("test-results/biscotti-snapshot.json","utf8"));await validateSnapshot(snapshot,archive.identity);
for(const [name,edit] of Object.entries({gap:(a:any)=>a.chunks.shift(),incomplete:(a:any)=>a.chunks[0].complete=false,anchor:(a:any)=>a.anchor.block++,amount:(a:any)=>a.chunks[0].trades[0].eth=-1,side:(a:any)=>a.chunks[0].trades[0].side="unknown",duplicate:(a:any)=>a.chunks[0].trades.push({...a.chunks[0].trades[0],eth:999})})){
 const invalid=structuredClone(archive);edit(invalid);const path="test-results/snapshot-invalid-"+name+".json";writeFileSync(path,JSON.stringify(invalid));
 const result=run(path,"test-results/snapshot-invalid-output.json");assert.notEqual(result.status,0,name+" must fail");
}
console.log("PASS: real prefix snapshot generation; gap, incomplete chunk, incorrect anchor, invalid amount/side and conflicting duplicate rejected");
