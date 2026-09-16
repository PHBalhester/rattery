import assert from "node:assert/strict";
// Feature 2 determinism: the shared-colony guarantees the store relies on.
//   1. two clients with the same history reach a byte-identical world
//   2. batched catch-up (store) == one-shot replay (batching is invisible)
//   3. replay -> live seam survives a JSON round-trip of the world (so any
//      client can resume the shared colony; the RNG lives in the world)
//   4. maxTicks clamps an over-long target (aged token stays bounded + agreeing)
// usage: npx tsx scripts/replay-test.ts
import { CONFIG } from "../src/config";
import { createWorld } from "../src/sim/colony";
import { tick } from "../src/sim/tick";
import { worldRng, mulberry32 } from "../src/sim/rng";
import { makeReplay, replayAll, tagNewHolders } from "../src/sim/replay";
import type { Trade, World } from "../src/types";

const tickMs = CONFIG.time.tickMs;
const dtDays = CONFIG.time.simDaysPerTick;
const t0 = 1_700_000_000_000;
const targetTick = 45_000; // ~75 sim-days
const opts = { t0, targetTick, tickMs, dtDays, maxTicks: 300_000 };

// Synthetic on-chain history: timestamped, block/logIndex increasing, buy-heavy.
function history(seed: number): Trade[] {
  const f = mulberry32(seed);
  const out: Trade[] = [];
  let ts = t0, block = 1000;
  for (let i = 0; i < 4000; i++) {
    ts += Math.floor(500 + f() * 6000);
    block += 1 + Math.floor(f() * 4);
    const usd = Math.max(1, Math.exp(3.4 + (f() - 0.5) * 2.4));
    out.push({
      id: `${block}:${i}`, ts, side: f() < 0.63 ? "buy" : "sell", usd,
      eth: usd / CONFIG.market.ethUsdRef, tokens: 0, trader: `w${Math.floor(f() * 60)}`,
      isNewHolder: false, venue: "curve", block, logIndex: i,
    });
  }
  tagNewHolders(out);
  return out;
}

const canon = (w: World) =>
  JSON.stringify({ ...w, realStartedAt: 0, env: { ...w.env, lastTradeAt: 0 } });

// 1. Two clients, same immutable chunks -> same world.
const wa = createWorld(CONFIG.colony.seed);
replayAll(wa, worldRng(wa), history(7), opts);
const wb = createWorld(CONFIG.colony.seed);
const rb = makeReplay(wb, worldRng(wb), history(7), opts);
const fr = mulberry32(1);
while (!rb.done()) rb.step(1 + Math.floor(fr() * 900)); // random small batches
console.log("1. dois clientes, mesma historia -> mundo identico:", canon(wa) === canon(wb));
console.log("   (isso ja cobre: replay em lotes == de uma vez so)");

// 3. Replay -> live seam. Continue N live ticks directly vs after a JSON
//    round-trip of the world at the seam. Must match (RNG lives in the world).
const LIVE = 3000;
const direct = createWorld(CONFIG.colony.seed);
replayAll(direct, worldRng(direct), history(7), opts);
{ const r = worldRng(direct); for (let i = 0; i < LIVE; i++) tick(direct, dtDays, r); }

const seam = createWorld(CONFIG.colony.seed);
replayAll(seam, worldRng(seam), history(7), opts);
const restored: World = JSON.parse(JSON.stringify(seam));
{ const r = worldRng(restored); for (let i = 0; i < LIVE; i++) tick(restored, dtDays, r); }
console.log("2. seam replay->live sobrevive round-trip JSON:", canon(direct) === canon(restored));

// 4. maxTicks clamps an over-long target.
const wd = createWorld(CONFIG.colony.seed);
const rd = makeReplay(wd, worldRng(wd), history(7), { ...opts, targetTick: 10_000_000, maxTicks: 45_000 });
while (!rd.done()) rd.step(1_000_000);
console.log("3. maxTicks limita target longo -> reached =", rd.reached(), "(cap 45000)");

assert.equal(canon(wa),canon(wb),"Replay batches must agree");
assert.equal(canon(direct),canon(restored),"Snapshot to live must agree");
assert.equal(rd.reached(),45000);
assert.equal(canon(wd),canon(wa));
assert.equal(wa.env.lastTradeAt,history(7).filter(t=>t.ts<t0+targetTick*tickMs).at(-1)!.ts,"Real trades must actually be applied");
