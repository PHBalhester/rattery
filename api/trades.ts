/**
 * GET /api/trades?chunk=N
 *
 * The RATTERY tape, read straight from Robinhood Chain. No DEX aggregator in
 * the path. Chunk N covers blocks
 *   [birth + N*CHUNK, birth + (N+1)*CHUNK - 1]
 * and returns every curve trade (CurveBuy/CurveSell on the token's bonding
 * curve) and every graduated-pool trade (v4 Swap for the Pons PoolId) in it,
 * ordered by (block, logIndex).
 *
 * Chunks behind the chain head are immutable, so they are cached at the CDN
 * for a year. Every visitor then reads the exact same bytes, which is what a
 * shared, deterministic colony will replay later. The head chunk is cached
 * for 2s, so RPC load does not grow with traffic.
 */
import { ENV, getLogs, hexNum, normAddr, rpc, rpcBatch, type Log, type Req, type Res } from "./_lib/eth.js";
import { PONS, TOPIC, decodeCurve, decodeSwap, resolveLaunch, type ChainTrade } from "./_lib/pons.js";

// Blocks behind head before a chunk counts as final. Arbitrum-style chains
// reorg rarely; a small margin keeps the immutable cache honest.
const CONFIRMATIONS = 4;

export default async function handler(req: Req, res: Res) {
  if (req.method === "OPTIONS") return res.status(204).end();

  const launch = await resolveLaunch().catch((e: unknown) => {
    res.setHeader("Cache-Control", "s-maxage=5");
    res.status(200).json({ ok: false, launched: !!ENV.ca, error: String((e as Error).message || e).slice(0, 160) });
    return undefined;
  });
  if (launch === undefined) return;
  if (launch === null) {
    res.setHeader("Cache-Control", "s-maxage=30, stale-while-revalidate=60");
    return res.status(200).json({ ok: true, launched: false, trades: [] });
  }

  const n = Number(Array.isArray(req.query.chunk) ? req.query.chunk[0] : req.query.chunk);
  if (!Number.isSafeInteger(n) || n < 0||!Number.isSafeInteger(launch.birthBlock+(n+1)*ENV.chunkBlocks)) {
    res.setHeader("Cache-Control", "s-maxage=60");
    return res.status(400).json({ ok: false, error: "chunk must be a non-negative integer" });
  }

  try {
    const head = hexNum(await rpc<string>("eth_blockNumber", []));
    const from = launch.birthBlock + n * ENV.chunkBlocks;
    const fullTo = from + ENV.chunkBlocks - 1;
    if (from > head) {
      res.setHeader("Cache-Control", "s-maxage=2");
      return res.status(200).json({ ok: true, launched: true, chunk: n, from, to: from - 1, head, complete: false, trades: [] });
    }
    const to = Math.min(fullTo, head);
    const complete = fullTo <= head - CONFIRMATIONS;

    const [curveLogs, swapLogs] = await Promise.all([
      getLogs({ address: launch.curve, topics: [[TOPIC.curveBuy, TOPIC.curveSell]] }, from, to),
      getLogs({ address: PONS.poolManager, topics: [TOPIC.swapV4, launch.poolId] }, from, to),
    ]);

    const partial: (Omit<ChainTrade, "ts"> & { trader?: string })[] = [];
    for (const l of curveLogs) {
      const t = decodeCurve(l);
      if (t) partial.push(t);
    }
    const swaps: { t: Omit<ChainTrade, "ts" | "trader">; l: Log }[] = [];
    for (const l of swapLogs) {
      const t = decodeSwap(l, launch.tokenIs1);
      if (t) swaps.push({ t, l });
    }

    // Curve and v4 indexed senders can be routers. Resolve transaction senders
    // consistently so routers are not counted as colony participants.
    const swapTxs = [...new Set([...partial.map(t => t.tx), ...swaps.map(s => s.t.tx)])];
    const txs = await rpcBatch(swapTxs.map((h) => ({ method: "eth_getTransactionByHash", params: [h] })));
    const fromByTx = new Map<string, string>(swapTxs.map((h, i) => {
      const sender = normAddr(txs[i]?.from);
      if (!sender) throw new Error("Missing transaction sender");
      return [h, sender];
    }));
    for (const t of partial) t.trader = fromByTx.get(t.tx) || "unknown";
    for (const s of swaps) partial.push({ ...s.t, trader: fromByTx.get(s.t.tx) || "unknown" });

    // Block timestamps: some nodes put blockTimestamp on the log, else fetch.
    const allLogs = [...curveLogs, ...swapLogs];
    const tsByBlock = new Map<number, number>();
    for (const l of allLogs) {
      const ts = hexNum(l.blockTimestamp) * 1000;
      if (Number.isFinite(ts) && ts > 0) tsByBlock.set(parseInt(l.blockNumber, 16), ts);
    }
    const missing = [...new Set(partial.map((t) => t.block))].filter((b) => !tsByBlock.has(b));
    const blocks = await rpcBatch(missing.map((b) => ({ method: "eth_getBlockByNumber", params: ["0x" + b.toString(16), false] })));
    missing.forEach((b, i) => {const ts=hexNum(blocks[i]?.timestamp)*1000;if(!Number.isFinite(ts)||ts<=0)throw new Error('Missing block timestamp');tsByBlock.set(b,ts);});

    const unique=[...new Map(partial.map(t=>[t.id,t])).values()];
    const trades: ChainTrade[] = unique
      .map((t) => ({ ...t, trader: t.trader || "unknown", ts: tsByBlock.get(t.block) || 0 }) as ChainTrade)
      .sort((a, b) => a.block - b.block || a.logIndex - b.logIndex);

    res.setHeader(
      "Cache-Control",
      complete ? "public, s-maxage=31536000, immutable" : "public, s-maxage=2, stale-while-revalidate=2"
    );
    return res.status(200).json({ ok: true, launched: true, chunk: n, from, to, head, complete, trades });
  } catch (e) {
    res.setHeader("Cache-Control", "s-maxage=3");
    return res.status(200).json({ ok: false, launched: true, chunk: n, error: String((e as Error).message || e).slice(0, 160) });
  }
}
