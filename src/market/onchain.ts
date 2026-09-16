import { CONFIG } from "../config";
import type { Trade } from "../types";
import type { FeedStatus } from "./types";

// Shape returned by /api/trades (see api/_lib/pons.ts ChainTrade).
interface ChainTrade {
  id: string;
  block: number;
  logIndex: number;
  tx: string;
  ts: number;
  side: "buy" | "sell";
  eth: number;
  tokens: number;
  trader: string;
  venue: "curve" | "pool";
}

interface ChunkResponse {
  ok: boolean;
  launched: boolean;
  chunk?: number;
  from?: number;
  to?: number;
  complete?: boolean;
  trades?: ChainTrade[];
  error?: string;
}

const key = (t: { block: number; logIndex: number }) => t.block * 100_000 + t.logIndex;

function toTrade(t: ChainTrade): Trade {
  return {
    id: t.id,
    ts: t.ts,
    side: t.side,
    eth: t.eth,
    usd: t.eth * CONFIG.market.ethUsdRef,
    tokens: t.tokens,
    trader: t.trader,
    isNewHolder: false, // decided by the feed orchestrator
    venue: t.venue,
    block: t.block,
    logIndex: t.logIndex,
  };
}

async function getChunk(n: number): Promise<ChunkResponse> {
  const r = await fetch(`/api/trades?chunk=${n}`,{signal:AbortSignal.timeout(15000)});
  if (!r.ok) throw new Error(`http ${r.status}`);
  const j = (await r.json()) as ChunkResponse;
  if (!j.ok) throw new Error(j.error || "trades error");
  return j;
}

/**
 * On-chain tape. On start it reads EVERY chunk from launch (chunk 0) to the
 * head, in order, and hands the whole history to the caller as one batch: the
 * store replays it deterministically so the colony reflects the token's entire
 * life, the same for every visitor. After that only trades past the cursor are
 * delivered live, one at a time. Chunks behind the head are immutable and
 * CDN-cached, so the full-history read is cheap after the first visitor warms
 * the cache.
 */
export function startOnchainFeed(opts: {
  headChunk: number;
  onHistory: (ts: Trade[]) => void;
  onTrade: (t: Trade) => void;
  onStatus?: (s: FeedStatus) => void;
  pollMs?: number;
}): () => void {
  const { headChunk, onHistory, onTrade, onStatus, pollMs = 2500 } = opts;
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let chunk = 0; // where live polling resumes after the history read
  let cursor = -1; // highest (block,logIndex) key delivered
  let backoff = pollMs;

  const sleep = (ms: number) =>
    new Promise<void>((res) => {
      timer = setTimeout(res, ms);
    });

  const run = async () => {
    // 1) Full history, every chunk in order. A gap would corrupt the shared
    // world, so a failed chunk is retried (the chunks are immutable) rather
    // than skipped.
    const history: Trade[] = [];
    for (let c = 0; c <= headChunk && !stopped; c++) {
      let tries = 0;
      for (;;) {
        try {
          const j = await getChunk(c);
          for (const t of j.trades ?? []) {
            history.push(toTrade(t));
            cursor = Math.max(cursor, key(t));
          }
          chunk = j.complete ? c + 1 : c;
          break;
        } catch {
          if (stopped) return;
          tries += 1;
          if (tries >= 6) {
            onStatus?.("error");
            await sleep(3000);
            tries = 0;
          } else {
            await sleep(500 * tries);
          }
        }
      }
    }
    if (stopped) return;
    onHistory(history);
    onStatus?.("live");

    // 2) Live tail: only trades newer than the cursor feed the nest.
    while (!stopped) {
      try {
        const j = await getChunk(chunk);
        if(stopped)return;
        for (const t of [...(j.trades ?? [])].sort((a,b)=>a.block-b.block||a.logIndex-b.logIndex)) {
          const k = key(t);
          if (k <= cursor) continue;
          cursor = k;
          onTrade(toTrade(t));
        }
        onStatus?.("live");
        backoff = pollMs;
        if (j.complete) {
          chunk += 1;
          continue;
        }
      } catch {
        onStatus?.("error");
        backoff = Math.min(15_000, backoff * 2);
      }
      await sleep(backoff);
    }
  };

  run();
  return () => {
    stopped = true;
    if (timer) clearTimeout(timer);
  };
}

// ---------------------------------------------------------------------------
// Feature 2: genesis replay support.
// ---------------------------------------------------------------------------

/**
 * Fetch every chunk from 0..headChunk for a deterministic genesis replay.
 * Deduped by trade id and sorted by (block, logIndex). t0 is the first trade's
 * timestamp, the colony's tick-0 anchor. A missing chunk aborts the load; the orchestrator retries instead of replaying incomplete history.
 */
export class HistoryLimitError extends Error {
  constructor() { super("History exceeds local replay limit"); this.name = "HistoryLimitError"; }
}

export async function fetchAllHistory(
  headChunk: number,
  options: { minTimestamp?: number; fromChunk?: number; afterKey?: number } = {}
): Promise<{ trades: Trade[]; t0: number }> {
  const raw: ChainTrade[] = [];
  const fromChunk=options.fromChunk??0;
  if(!Number.isSafeInteger(fromChunk)||fromChunk<0||!Number.isSafeInteger(headChunk)||headChunk<fromChunk)throw new Error("Invalid history range");
  for (let c = fromChunk; c <= headChunk; c++) {
    const j = await getChunk(c);
    if(!j.launched)throw new Error('Token unavailable during history replay');
    if (options.minTimestamp !== undefined && (j.trades ?? []).some(t => t.ts < options.minTimestamp!)) throw new HistoryLimitError();
    for (const t of j.trades ?? []) if(options.afterKey===undefined||key(t)>options.afterKey)raw.push(t);
  }
  const seen = new Set<string>();
  const uniq = raw.filter((t) => (seen.has(t.id) ? false : (seen.add(t.id), true)));
  uniq.sort((a, b) => a.block - b.block || a.logIndex - b.logIndex);
  const trades = uniq.map((t) => toTrade(t));
  const t0 = trades.length ? trades[0].ts : Date.now();
  return { trades, t0 };
}

/**
 * Live tail: poll from `startChunk` and emit only trades newer than `startKey`
 * (the last key the replay applied). isNewHolder is decided against the shared
 * holder set carried over from the replay, so holder numbering is continuous.
 */
export function startOnchainLive(opts: {
  startChunk: number;
  startKey: number;
  holders: Set<string>;
  onTrade: (t: Trade) => void;
  onStatus?: (s: FeedStatus) => void;
  pollMs?: number;
}): () => void {
  const { startChunk, startKey, holders, onTrade, onStatus, pollMs = 2500 } = opts;
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let chunk = startChunk;
  let cursor = startKey;
  let backoff = pollMs;
  const sleep = (ms: number) =>
    new Promise<void>((res) => {
      timer = setTimeout(res, ms);
    });

  const run = async () => {
    while (!stopped) {
      try {
        const j = await getChunk(chunk);
        if(stopped)return;
        for (const t of [...(j.trades ?? [])].sort((a,b)=>a.block-b.block||a.logIndex-b.logIndex)) {
          const k = key(t);
          if (k <= cursor) continue;
          cursor = k;
          const tr = toTrade(t);
          tr.isNewHolder = !holders.has(tr.trader);
          holders.add(tr.trader);
          onTrade(tr);
        }
        onStatus?.("live");
        backoff = pollMs;
        if (j.complete) {
          chunk += 1;
          continue;
        }
      } catch {
        onStatus?.("error");
        backoff = Math.min(15_000, backoff * 2);
      }
      await sleep(backoff);
    }
  };
  run();
  return () => {
    stopped = true;
    if (timer) clearTimeout(timer);
  };
}
