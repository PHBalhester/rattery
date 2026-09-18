import assert from 'node:assert/strict';
// Two checks the shared colony depends on:
//   1. same seed + same tape -> byte-identical world
//   2. JSON snapshot mid-run + resume == uninterrupted run (RNG lives in World)
// usage: npx tsx scripts/determinism-test.ts
import { CONFIG } from "../src/config";
import { createWorld } from "../src/sim/colony";
import { tick } from "../src/sim/tick";
import { applyTrade } from "../src/sim/marketMap";
import { mulberry32, worldRng } from "../src/sim/rng";
import type { World } from "../src/types";

const DT = CONFIG.time.tickMs / CONFIG.time.realMsPerSimDay;

function tape(seed: number, ticks: number) {
  const f = mulberry32(seed);
  const out = new Map<number, { side: "buy" | "sell"; usd: number; isNewHolder: boolean }[]>();
  for (let i = 4; i < ticks; i += 4 + Math.floor(f() * 13)) {
    out.set(i, [{ side: f() < 0.64 ? "buy" : "sell", usd: Math.exp(3.4 + (f() - 0.5) * 2.4), isNewHolder: f() < 0.2 }]);
  }
  return out;
}

function run(world: World, from: number, to: number, t: ReturnType<typeof tape>) {
  const rng = worldRng(world);
  for (let i = from; i < to; i++) {
    for (const x of t.get(i) ?? [])
      world.env = applyTrade(world.env, { id: String(i), ts: i * 100, eth: x.usd / 2400, tokens: 0, trader: "w", venue: "demo", ...x });
    tick(world, DT, rng);
  }
  return world;
}

// lastTradeAt / realStartedAt come from Date.now() and are display-only.
const canon = (w: World) => JSON.stringify({ ...w, realStartedAt: 0, env: { ...w.env, lastTradeAt: 0 } });

const days=Number(process.env.RATTERY_DETERMINISM_DAYS??30);
assert(Number.isInteger(days)&&days>=30&&days<=120);
const N = days * 600; // Bounded CI; set RATTERY_DETERMINISM_DAYS=120 for the long run.
const t = tape(7, N);
const a = canon(run(createWorld(CONFIG.colony.seed), 0, N, t));
const b = canon(run(createWorld(CONFIG.colony.seed), 0, N, t));
console.log("1. mesma seed + mesma fita, mundos idênticos:", a === b, `(${(a.length / 1024).toFixed(0)} KB)`);

const half = createWorld(CONFIG.colony.seed);
run(half, 0, N / 2, t);
const restored: World = JSON.parse(JSON.stringify(half));
const c = canon(run(restored, N / 2, N, t));
console.log("2. snapshot no meio + retomada == corrida direta:", a === c);

assert.equal(a,b,"Identical history must reproduce the world");
assert.equal(a,c,"Snapshot restore must match uninterrupted simulation");
