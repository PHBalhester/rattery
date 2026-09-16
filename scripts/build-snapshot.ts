import { readFileSync, writeFileSync, renameSync } from "node:fs";
import { buildSnapshot } from "./lib/snapshot-build";
const [input,output,previous]=process.argv.slice(2);
if(!input||!output)throw new Error("Usage: tsx scripts/build-snapshot.ts archive.json snapshot.json [previous.json]");
const read=(path:string)=>JSON.parse(readFileSync(path,"utf8").replace(/^\uFEFF/,""));
const snapshot=await buildSnapshot(read(input),previous?read(previous):undefined);
writeFileSync(output+".tmp",JSON.stringify(snapshot));renameSync(output+".tmp",output);
console.log(JSON.stringify({output,tick:snapshot.cursor.tick,holders:snapshot.holders.length,anchor:snapshot.anchor.block}));
