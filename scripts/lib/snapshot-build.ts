import { CONFIG } from "../../src/config";
import { createWorld } from "../../src/sim/colony";
import { worldRng } from "../../src/sim/rng";
import { makeReplay, tagNewHolders } from "../../src/sim/replay";
import { sealSnapshot, validateSnapshot, type ColonySnapshot } from "../../src/sim/snapshot";
import type { Trade } from "../../src/types";

// Trusted publisher input; collector verifies anchors against RPC separately.
export async function buildSnapshot(archive:any, previous?:ColonySnapshot) {
const {identity,anchor,chunks}=archive;
if(!Array.isArray(chunks)||!chunks.length)throw new Error("Archive chunks required");
const prior=previous?await validateSnapshot(previous,identity):null;
if(archive.scope!==(prior?"complete-tail":"complete-prefix"))throw new Error("Incorrect archive scope");
let next=identity.birthBlock;
if(prior){
  const proof=archive.previousAnchor;
  if(!proof||proof.block!==prior.anchor.block||proof.hash!==prior.anchor.hash||proof.timestamp!==prior.anchor.timestamp)throw new Error("Previous anchor mismatch");
  if(anchor.block<prior.anchor.block||anchor.timestamp<prior.anchor.timestamp)throw new Error("Anchor regressed");
  const rewind=prior.cursor.lastKey<0?identity.birthBlock:Math.floor(prior.cursor.lastKey/100000);
  if(!Number.isSafeInteger(chunks[0].from)||chunks[0].from<identity.birthBlock||chunks[0].from>rewind)throw new Error("Tail skips snapshot boundary");
  next=chunks[0].from;
}
const rows:any[]=[];
for(const chunk of chunks){
  if(!chunk.ok||!chunk.launched||!chunk.complete||chunk.from!==next||!Number.isSafeInteger(chunk.to)||chunk.to<chunk.from)throw new Error("Missing or incomplete chunk");
  for(const t of chunk.trades){if(!Number.isSafeInteger(t.block)||t.block<chunk.from||t.block>chunk.to||!Number.isSafeInteger(t.logIndex)||t.logIndex<0||t.logIndex>=100000||!Number.isFinite(t.ts)||t.ts<=0||!Number.isFinite(t.eth)||t.eth<0||!Number.isFinite(t.tokens)||t.tokens<0||!["buy","sell"].includes(t.side)||!/^0x[0-9a-f]{40}$/.test(t.trader)||typeof t.id!=="string"||!t.id)throw new Error("Invalid archive trade");rows.push(t);}
  next=chunk.to+1;
}
if(anchor.block!==next-1)throw new Error("Anchor must end the complete archive prefix");
const unique=new Map<string,any>();for(const t of rows){if(unique.has(t.id)&&JSON.stringify(unique.get(t.id))!==JSON.stringify(t))throw new Error("Conflicting duplicate trade");unique.set(t.id,t);}
const sorted=[...unique.values()].sort((a,b)=>a.block-b.block||a.logIndex-b.logIndex);
for(let i=0;i<sorted.length;i++){
  const row=sorted[i],prev=sorted[i-1];
  if(row.ts>anchor.timestamp)throw new Error("Trade exceeds anchor time");
  if(prev&&row.block===prev.block&&row.logIndex===prev.logIndex)throw new Error("Conflicting trade position");
  if(prev&&row.ts<prev.ts)throw new Error("Trade timestamps regressed");
}
if(!sorted.length&&!prior)throw new Error("No initial trade to anchor colony time");
const t0=prior?.t0??sorted[0].ts;
// Snapshot ends BEFORE the anchor timestamp, so trades sharing that timestamp
// remain in the tail and cannot be missed across fast L2 blocks.
const targetTick=Math.floor((anchor.timestamp-t0)/CONFIG.time.tickMs);
if(targetTick<0)throw new Error("Invalid anchor timestamp");
const trades:Trade[]=sorted.filter(t=>(!prior||t.block*100000+t.logIndex>prior.cursor.lastKey)&&Math.floor((t.ts-t0)/CONFIG.time.tickMs)<targetTick).map(t=>({...t,usd:t.eth*CONFIG.market.ethUsdRef,isNewHolder:false}));
const holders=tagNewHolders(trades,new Set(prior?.holders??[])),world=prior?.world??createWorld(CONFIG.colony.seed);if(!prior){world.realStartedAt=t0;world.env.lastTradeAt=t0;}
const replay=makeReplay(world,worldRng(world),trades,{t0,targetTick,tickMs:CONFIG.time.tickMs,dtDays:CONFIG.time.simDaysPerTick,maxTicks:targetTick,resume:prior?.cursor});
while(!replay.done())replay.step(10000);
const snapshot=await sealSnapshot({identity,t0,anchor,cursor:replay.cursor(),holders:[...holders].sort(),world});
await validateSnapshot(snapshot,identity);
return snapshot;
}
