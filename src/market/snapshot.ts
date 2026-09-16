import { validateSnapshot, type SnapshotIdentity } from "../sim/snapshot";
export async function fetchSnapshot(identity: SnapshotIdentity) {
  const r=await fetch("/api/snapshot",{cache:"no-store",signal:AbortSignal.timeout(15000)});
  if(r.status===404)return null;
  // Vite without API routes serves HTML; there is no snapshot in demo mode.
  if(r.ok && !(r.headers.get("content-type")||"").includes("json"))return null;
  if(!r.ok)throw new Error(`Snapshot HTTP ${r.status}`);
  const body=await r.json();if(!body.ok)throw new Error(body.error||"Snapshot unavailable");
  return body.snapshot ? validateSnapshot(body.snapshot,identity) : null;
}
