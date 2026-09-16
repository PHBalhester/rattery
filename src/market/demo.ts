import type { Trade } from "../types";
import { CONFIG } from "../config";
import { mulberry32 } from "../sim/rng";

// Standard-normal via Box-Muller, driven by the demo rng so the demo tape is
// reproducible for a given seed.
function gauss(rng: () => number) {
  let u = 0;
  let v = 0;
  while (u === 0) u = rng();
  while (v === 0) v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function shortWallet(rng: () => number) {
  const hex = "0123456789abcdef";
  let s = "0x";
  for (let i = 0; i < 6; i++) s += hex[Math.floor(rng() * 16)];
  return s;
}

/**
 * Synthetic tape used before launch. Emits lognormal buys and sells every
 * 0.4-1.6s, ~20% of them from a brand-new holder. The buy bias keeps a demo
 * colony viable so the mechanics are visible.
 */
export function startDemoFeed(emit: (t: Trade) => void, seed = 0xdec0de): () => void {
  const rng = mulberry32(seed);
  const holders = new Set<string>();
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let n = 0;

  const schedule = () => {
    // ~0.4-1.6s between trades. At 1 sim-day = 60 real seconds that is roughly
    // 60 trades/sim-day, dense enough to keep the nest fed. See config.ts
    // balance notes: below ~0.60 buy share the colony collapses, so the demo
    // tape runs buy-heavy the way a real launch does. This shapes the demo
    // only; the live tape is whatever Pons reports.
    const waitMs = 400 + rng() * 1200;
    timer = setTimeout(() => {
      if (stopped) return;
      const isNewHolder = rng() < 0.2;
      const trader = isNewHolder ? shortWallet(rng) : pickHolder(rng, holders);
      holders.add(trader);
      if(holders.size>4096)holders.delete(holders.values().next().value!);
      const side = rng() < 0.63 ? "buy" : "sell";
      // lognormal USD: median ~ e^3.4 (~30), heavy right tail for the occasional whale
      const usd = Math.max(1, Math.exp(3.4 + gauss(rng) * 1.1));
      emit({
        id: `demo-${n++}`,
        ts: Date.now(),
        side,
        usd,
        eth: usd / CONFIG.market.ethUsdRef,
        tokens: usd / (0.0001 + rng() * 0.0003),
        trader,
        isNewHolder,
        venue: "demo",
      });
      schedule();
    }, waitMs);
  };

  schedule();
  return () => {
    stopped = true;
    if (timer) clearTimeout(timer);
  };
}

function pickHolder(rng: () => number, holders: Set<string>): string {
  if (holders.size === 0) {
    const w = "0x" + Math.floor(rng() * 1e9).toString(16);
    return w;
  }
  const arr = Array.from(holders);
  return arr[Math.floor(rng() * arr.length)];
}
