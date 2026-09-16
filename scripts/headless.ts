// Headless harness: runs the sim against a synthetic tape quantized to ticks.
// usage: npx tsx scripts/headless.ts [days] [buyShare] [feedSeed]
//   env GAP=k multiplies the gap between trades (k=10 -> ~6 trades/sim-day)
import { CONFIG } from "../src/config";
import { createWorld, aliveRats } from "../src/sim/colony";
import { tick, stats } from "../src/sim/tick";
import { applyTrade } from "../src/sim/marketMap";
import { mulberry32, worldRng } from "../src/sim/rng";
import type { Trade, WorldEvent } from "../src/types";

const days = Number(process.argv[2] ?? 250);
const buyShare = Number(process.argv[3] ?? 0.63);
const feedSeed = Number(process.argv[4] ?? 0xdec0de);
const gap = Number(process.env.GAP ?? 1);

const world = createWorld(CONFIG.colony.seed);
const rng = worldRng(world);
const frng = mulberry32(feedSeed);
const gauss = () => {
  let u = 0, v = 0;
  while (u === 0) u = frng();
  while (v === 0) v = frng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
};

// Count every event as it is pushed (the log itself is capped for display).
const kinds: Record<string, number> = {};
const causes: Record<string, number> = {};
const unshift = world.events.unshift.bind(world.events);
(world.events as any).unshift = (...evs: WorldEvent[]) => {
  for (const e of evs) {
    kinds[e.kind] = (kinds[e.kind] ?? 0) + 1;
    if (e.kind === "death") causes[e.extra ?? "?"] = (causes[e.extra ?? "?"] ?? 0) + 1;
  }
  return unshift(...evs);
};

const dt = CONFIG.time.tickMs / CONFIG.time.realMsPerSimDay;
const totalTicks = Math.round(days / dt);
let nextTradeTick = 4, n = 0, trades = 0, maxAlive = 0, maxGen = 0;
let extinctAt: number | null = null;
const t0 = performance.now();

for (let i = 0; i < totalTicks; i++) {
  while (i >= nextTradeTick) {
    const usd = Math.max(1, Math.exp(3.4 + gauss() * 1.1));
    const t: Trade = {
      id: `h${n++}`, ts: 0, side: frng() < buyShare ? "buy" : "sell", usd,
      eth: usd / CONFIG.market.ethUsdRef, tokens: 0, trader: "x", isNewHolder: frng() < 0.2, venue: "demo",
    };
    world.env = applyTrade(world.env, t);
    trades++;
    nextTradeTick += Math.max(1, Math.round((4 + Math.floor(frng() * 13)) * gap));
  }
  tick(world, dt, rng);
  const alive = aliveRats(world).length;
  if (alive > maxAlive) maxAlive = alive;
  if (alive === 0 && extinctAt === null) extinctAt = world.simDay;
}
for (const r of aliveRats(world)) if (r.gen > maxGen) maxGen = r.gen;
const s = stats(world);
const ms = performance.now() - t0;
console.log(JSON.stringify({
  days, buyShare, feedSeed, gap, trades,
  alive: s.alive, maxAlive, maxGen: Math.max(maxGen, s.generations),
  extinctAt: extinctAt && +extinctAt.toFixed(1),
  litters: s.births, pupsBorn: s.pupsBorn, deaths: s.deaths, causes, kinds,
  ratsInMap: Object.keys(world.rats).length,
  ms: Math.round(ms), ticksPerSec: Math.round(totalTicks / (ms / 1000)),
}));
