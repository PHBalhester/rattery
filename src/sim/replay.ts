// Feature 2: the shared, persistent colony.
//
// A visitor should not start the colony from its founders the moment they open
// the tab. They should arrive at the colony as it is now, having lived the
// token's whole history. Because chunks behind the chain head are immutable and
// cached for a year (see api/trades.ts), every client fetches the exact same
// trade bytes, so a deterministic replay of them reaches the exact same colony.
//
// Timeline anchor: tick 0 is the first on-chain trade (t0). The colony's tick
// index at wall-clock `now` is floor((now - t0) / tickMs), i.e. it ages 1
// sim-tick per tickMs of real time since launch, the same rate the live loop
// uses. Two clients that load seconds apart agree on the whole shared history
// and differ only in the trailing live ticks, like two viewers of one stream a
// few seconds apart.
//
// This is a genesis replay (it always starts at tick 0), so it is exact, but
// its cost grows with the token's age. maxTicks is a safety cap that keeps a
// page load bounded; past it the colony stops aging faster than a snapshot
// could restore. For a freshly launched token the cap is never hit for hours,
// which is the window that matters. The clean, unbounded fix later is a
// server-side world snapshot to resume from instead of replaying from genesis.
import type { Trade, World } from "../types";
import { applyTrade } from "./marketMap";
import { tick } from "./tick";

export interface ReplayCursor {
  tick: number; // next simulation tick; all earlier ticks are complete
  lastKey: number; // last applied (block, logIndex) key, or -1
}

export interface ReplayOpts {
  t0: number; // unix ms of the first trade (tick 0)
  targetTick: number; // colony age in ticks at load = floor((now - t0)/tickMs)
  tickMs: number; // real ms per sim-tick (CONFIG.time.tickMs)
  dtDays: number; // sim-days per tick (CONFIG.time.simDaysPerTick)
  maxTicks: number; // safety cap on ticks advanced in this replay
  resume?: ReplayCursor; // trusted cursor saved together with the world and RNG
}

const keyOf = (t: Trade) => (t.block ?? 0) * 100_000 + (t.logIndex ?? 0);

/**
 * A steppable replay so the caller can spread the work across animation frames
 * and keep the tab responsive. `trades` must be sorted ascending by
 * (block, logIndex). The world and rng are mutated in place; pass
 * worldRng(world) so the RNG state travels with the snapshot.
 */
export function makeReplay(world: World, rng: () => number, trades: Trade[], opts: ReplayOpts) {
  const { t0, tickMs, dtDays } = opts;
  const start = opts.resume?.tick ?? 0;
  if (![start, opts.targetTick, opts.maxTicks].every(n => Number.isSafeInteger(n) && n >= 0)
      || opts.targetTick < start || !Number.isFinite(t0) || !(tickMs > 0 && Number.isFinite(tickMs))
      || !(dtDays > 0 && Number.isFinite(dtDays))) throw new Error("Invalid replay timing");
  const target = start + Math.min(opts.targetTick - start, opts.maxTicks);
  const tickOf = (ts: number) => {
    const n = Math.floor((ts - t0) / tickMs);
    return n < 0 ? 0 : n;
  };
  let ti = start;
  let k = 0;
  let lastKey = opts.resume?.lastKey ?? -1;
  if (!Number.isSafeInteger(lastKey) || lastKey < -1) throw new Error("Invalid replay cursor");
  if (opts.resume) {
    while (k < trades.length && keyOf(trades[k]) <= lastKey) k++;
    if (k < trades.length && tickOf(trades[k].ts) < start) throw new Error("Trade predates replay checkpoint");
  }

  return {
    target,
    reached: () => ti,
    lastKey: () => lastKey,
    cursor: (): ReplayCursor => ({ tick: ti, lastKey }),
    done: () => ti >= target,
    /** Advance up to `budget` ticks. Returns how many ticks it advanced. */
    step(budget: number): number {
      if (!Number.isSafeInteger(budget) || budget < 0) throw new Error("Invalid replay budget");
      let n = 0;
      while (ti < target && n < budget) {
        // Apply every trade that belongs at or before this tick, in order.
        while (k < trades.length && tickOf(trades[k].ts) <= ti) {
          world.env = applyTrade(world.env, trades[k]);
          const key = keyOf(trades[k]);
          if (key > lastKey) lastKey = key;
          k++;
        }
        tick(world, dtDays, rng);
        ti++;
        n++;
      }
      return n;
    },
  };
}

/** Run the whole replay at once (used by the headless determinism test). */
export function replayAll(world: World, rng: () => number, trades: Trade[], opts: ReplayOpts) {
  const r = makeReplay(world, rng, trades, opts);
  while (!r.done()) r.step(1_000_000);
  return { reachedTick: r.reached(), lastKey: r.lastKey() };
}

/**
 * Mark each trade's first-seen wallet as a new holder, in chain order, exactly
 * as the live orchestrator does. Returns the running holder set so the live
 * tail can keep numbering holders from where the replay left off.
 */
export function tagNewHolders(trades: Trade[], holders = new Set<string>()): Set<string> {
  for (const t of trades) {
    if (!holders.has(t.trader)) {
      t.isNewHolder = true;
      holders.add(t.trader);
    } else {
      t.isNewHolder = false;
    }
  }
  return holders;
}
