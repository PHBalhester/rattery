import type { ColonySnapshot, SnapshotIdentity } from "../../src/sim/snapshot";
import { collectSnapshotArchive, type CollectionIO } from "./snapshot-collect";
import { buildSnapshot } from "./snapshot-build";

// Commit each validated batch before fetching another. A failed batch never
// replaces the last good snapshot; restarting with that file resumes safely.
export async function collectSnapshotBatches(options: {
 io: CollectionIO;
 identity: SnapshotIdentity;
 previous?: ColonySnapshot;
 maxChunks?: number;
 rounds?: number;
 save: (snapshot: ColonySnapshot) => Promise<void>;
 progress?: (snapshot: ColonySnapshot, round: number) => void;
}) {
 const rounds=options.rounds??1;
 if(!Number.isSafeInteger(rounds)||rounds<1||rounds>100)throw new Error("rounds must be 1..100");
 let previous=options.previous,completed=0;
 for(let round=1;round<=rounds;round++){
  const archive=await collectSnapshotArchive(options.io,options.identity,previous,options.maxChunks??10);
  if(!archive)return {snapshot:previous,completed,caughtUp:true};
  const next=await buildSnapshot(archive,previous);
  await options.save(next);
  previous=next;completed++;
  options.progress?.(next,round);
 }
 return {snapshot:previous,completed,caughtUp:false};
}
