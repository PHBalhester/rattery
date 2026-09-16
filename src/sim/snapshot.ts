import { CONFIG } from "../config";
import type { World } from "../types";
import type { ReplayCursor } from "./replay";

// Bump when simulation rules change, even when CONFIG does not.
export const SNAPSHOT_MODEL = "rattery-2026-09-16-v6";
export interface SnapshotIdentity { chainId: number; token: string; birthBlock: number }
export interface ColonySnapshot {
  schema: 1;
  model: string;
  configHash: string;
  identity: SnapshotIdentity;
  t0: number;
  cursor: ReplayCursor;
  anchor: { block: number; hash: string; timestamp: number };
  holders: string[];
  world: World;
  checksum: string;
}
const address = /^0x[0-9a-f]{40}$/;
const hash = /^0x[0-9a-f]{64}$/;
export const MAX_SNAPSHOT_BYTES = 16 * 1024 * 1024;
function canonical(value: unknown): string {
  if (Array.isArray(value)) return "[" + value.map(canonical).join(",") + "]";
  if (value && typeof value === "object") return "{" + Object.keys(value).sort().map(k => JSON.stringify(k) + ":" + canonical((value as Record<string, unknown>)[k])).join(",") + "}";
  return JSON.stringify(value);
}
async function digest(value: unknown) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonical(value)));
  return Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2,"0")).join("");
}
export async function sealSnapshot(input: Omit<ColonySnapshot, "schema" | "model" | "configHash" | "checksum">): Promise<ColonySnapshot> {
  // JSON serialization is the storage boundary (removes optional undefined fields).
  const payload = JSON.parse(JSON.stringify({ identity:input.identity, t0:input.t0, cursor:input.cursor, anchor:input.anchor, holders:input.holders, world:input.world, schema: 1, model: SNAPSHOT_MODEL, configHash: await digest(CONFIG) }));
  return { ...payload, checksum: await digest(payload) };
}
function finiteTree(value: unknown, depth = 0): boolean {
  if (depth > 40) return false;
  if (typeof value === "number") return Number.isFinite(value);
  if (value && typeof value === "object") return Object.entries(value).every(([k,v]) => !["__proto__","constructor","prototype"].includes(k) && finiteTree(v,depth+1));
  return true;
}
export async function validateSnapshot(raw: unknown, identity: SnapshotIdentity): Promise<ColonySnapshot> {
  if (![4663,46630].includes(identity.chainId) || !Number.isSafeInteger(identity.birthBlock) || identity.birthBlock < 0) throw new Error("Invalid snapshot identity");
  if (!raw || typeof raw !== "object") throw new Error("Invalid snapshot");
  const s = raw as ColonySnapshot;
  if (JSON.stringify(raw).length > MAX_SNAPSHOT_BYTES || !finiteTree(raw)) throw new Error("Invalid snapshot data");
  if (s.schema !== 1 || s.model !== SNAPSHOT_MODEL || s.configHash !== await digest(CONFIG)) throw new Error("Snapshot model mismatch");
  if (!s.identity || s.identity.chainId !== identity.chainId || s.identity.token !== identity.token.toLowerCase() || s.identity.birthBlock !== identity.birthBlock || !address.test(s.identity.token)) throw new Error("Snapshot identity mismatch");
  if (![s.cursor?.tick,s.anchor?.block].every(x => Number.isSafeInteger(x) && x >= 0) || !Number.isSafeInteger(s.cursor.lastKey) || s.cursor.lastKey < -1 || !hash.test(s.anchor.hash)) throw new Error("Invalid snapshot cursor");
  if (typeof s.t0 !== "number" || typeof s.anchor.timestamp !== "number" || !(s.t0 > 0) || !(s.anchor.timestamp >= s.t0) || s.anchor.block < identity.birthBlock || s.cursor.tick > Math.floor((s.anchor.timestamp-s.t0)/CONFIG.time.tickMs)) throw new Error("Invalid snapshot timing");
  if (s.cursor.tick === 0 && s.cursor.lastKey !== -1) throw new Error("Invalid initial snapshot cursor");
  if (s.cursor.lastKey !== -1 && (Math.floor(s.cursor.lastKey/100000) < identity.birthBlock || Math.floor(s.cursor.lastKey/100000) > s.anchor.block)) throw new Error("Invalid snapshot trade cursor");
  if (!s.world || s.world.seed !== CONFIG.colony.seed || !Number.isInteger(s.world.rngState) || !s.world.rats || !s.world.env || !s.world.totals || !Array.isArray(s.world.events) || !Number.isInteger(s.world.nextId)) throw new Error("Invalid snapshot world");
  if (typeof s.world.simDay !== "number" || Math.abs(s.world.simDay-s.cursor.tick*CONFIG.time.simDaysPerTick)>1e-5) throw new Error("Snapshot world clock mismatch");
  if (!Array.isArray(s.holders) || s.holders.some(h => !address.test(h)) || new Set(s.holders).size !== s.holders.length) throw new Error("Invalid snapshot holders");
  for (const [id,rat] of Object.entries(s.world.rats)) if (rat.id !== id || !["M","F"].includes(rat.sex) || !rat.genome || !rat.hormones || !Array.isArray(rat.nursing) || ![rat.x,rat.y,rat.energy,rat.heat,rat.bornAt,...Object.values(rat.hormones)].every(v=>typeof v === "number" && Number.isFinite(v))) throw new Error("Invalid snapshot rat");
  if(s.world.memorial){
    if(typeof s.world.memorial!=='object'||Array.isArray(s.world.memorial))throw new Error('Invalid memorial');
    for(const [id,r] of Object.entries(s.world.memorial))if(!r||r.id!==id||typeof r.name!=='string'||!['M','F'].includes(r.sex)||![r.bornAt,r.deadAt,r.gen,r.offspring].every(v=>typeof v==='number'&&Number.isFinite(v))||r.deadAt!<r.bornAt||r.deadAt!>s.world.simDay||!['age','starvation','cold','neonatal_abandon','neonatal_cannibal','stillbirth','crowding','none'].includes(r.deathCause)||![r.motherId,r.fatherId].every(v=>v===null||typeof v==='string'))throw new Error('Invalid memorial record');
  }
  const {checksum,...payload}=s;
  if (checksum !== await digest(payload)) throw new Error("Snapshot checksum mismatch");
  return JSON.parse(JSON.stringify(s));
}
