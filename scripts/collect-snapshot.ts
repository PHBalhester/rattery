import { readFileSync, writeFileSync, renameSync } from "node:fs";
import { ENV, rpc } from "../api/_lib/eth";
import { collectSnapshotBatches } from "./lib/snapshot-batches";
const [base,output,previous,max="10",rounds="1"]=process.argv.slice(2);
if(!base||!output||!ENV.ca||ENV.birthBlock===null)throw new Error("Usage: RATTERY_CA=... RATTERY_BIRTH_BLOCK=... npm run snapshot:collect -- https://your-api snapshot.json [previous.json|-] [maxChunks] [rounds]");
const origin=new URL(base);
if(origin.protocol!=="https:"&&!(origin.protocol==="http:"&&["localhost","127.0.0.1"].includes(origin.hostname)))throw new Error("API requires HTTPS (localhost allowed)");
const prior=previous&&previous!=="-"?JSON.parse(readFileSync(previous,"utf8").replace(/^\uFEFF/,"")):undefined;
const result=await collectSnapshotBatches({
 io:{rpc,api:async path=>{const response=await fetch(new URL(path,origin),{cache:"no-store",redirect:"error",signal:AbortSignal.timeout(30000)});if(!response.ok)throw new Error(`API HTTP ${response.status}`);return response.json();}},
 identity:{chainId:ENV.chainId,token:ENV.ca,birthBlock:ENV.birthBlock},
 previous:prior,maxChunks:Number(max),rounds:Number(rounds),
 save:async snapshot=>{writeFileSync(output+".tmp",JSON.stringify(snapshot));renameSync(output+".tmp",output);},
 progress:(snapshot,round)=>console.log(JSON.stringify({output,round,anchor:snapshot.anchor.block,tick:snapshot.cursor.tick})),
});
console.log(JSON.stringify({completed:result.completed,caughtUp:result.caughtUp}));
