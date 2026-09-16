// Shared JSON-RPC + ABI helpers for the Vercel functions. Files under api/_lib
// are not routes (underscore prefix). Read-only: nothing here signs or writes.
declare const process: { env: Record<string, string | undefined> };

// Read lazily so tests (and any future hot-reload) see the current env.
export const ENV = {
  get chainId() { const id=Number(process.env.RATTERY_CHAIN_ID||4663);if(id!==4663&&id!==46630)throw new Error('Unsupported RATTERY_CHAIN_ID');return id; },
  get rpc() {
    return process.env.RATTERY_RPC || (ENV.chainId===46630?"https://rpc.testnet.chain.robinhood.com/rpc":"https://rpc.mainnet.chain.robinhood.com/rpc");
  },
  get ca() {
    return normAddr(process.env.RATTERY_CA);
  },
  get birthBlock() {
    return parseBlock(process.env.RATTERY_BIRTH_BLOCK);
  },
  // Optional curve override and expected canonical pool ID.
  // Alternate pools require independently verified currency metadata.
  get curve() {
    return normAddr(process.env.RATTERY_CURVE);
  },
  get poolId() {
    return normBytes32(process.env.RATTERY_POOL_ID);
  },
  // Blocks per cached trade chunk, and max blocks per eth_getLogs call.
  get chunkBlocks() {
    return Math.max(10, Number(process.env.RATTERY_CHUNK_BLOCKS) || 1200);
  },
  get logsRange() {
    return Math.max(10, Number(process.env.RATTERY_LOGS_RANGE) || 1200);
  },
  get blockscout() {
    return process.env.RATTERY_BLOCKSCOUT || (ENV.chainId===46630?"https://explorer.testnet.chain.robinhood.com":"https://robinhoodchain.blockscout.com");
  },
};

export function normAddr(x: string | undefined): string {
  const s = (x || "").trim().toLowerCase();
  return /^0x[0-9a-f]{40}$/.test(s) ? s : "";
}

export function normBytes32(x: string | undefined): string {
  const s = (x || "").trim().toLowerCase();
  return /^0x[0-9a-f]{64}$/.test(s) ? s : "";
}

export function parseBlock(raw: string | undefined): number | null {
  const s = (raw || "").trim();
  if (!s) return null;
  if (!/^(?:0x[0-9a-f]+|[0-9]+)$/i.test(s)) return null;
  const n = Number(s);
  return Number.isSafeInteger(n) && n >= 0 ? n : null;
}

export const toHex = (n: number) => "0x" + n.toString(16);
export const hexNum = (h: string | null | undefined) => (h ? parseInt(h, 16) : 0);
export const padTopic = (addr: string) => "0x" + addr.replace(/^0x/, "").toLowerCase().padStart(64, "0");
export const topicAddr = (t: string) => "0x" + t.slice(-40).toLowerCase();

/** 32-byte word i of ABI data, as unsigned bigint. */
export function word(data: string, i: number): bigint {
  const h = data.startsWith("0x") ? data.slice(2) : data;
  const w = h.slice(i * 64, (i + 1) * 64);
  return w ? BigInt("0x" + w) : 0n;
}

/** Same word read as a two's-complement signed int256 (int128 is sign-extended). */
export function wordSigned(data: string, i: number): bigint {
  const u = word(data, i);
  return u >= 1n << 255n ? u - (1n << 256n) : u;
}

/** wei-like integer -> float with `decimals`. Deterministic for a given input. */
export function toFloat(v: bigint, decimals = 18): number {
  const neg = v < 0n;
  const a = neg ? -v : v;
  const base = 10n ** BigInt(decimals);
  const whole = a / base;
  const frac = a % base;
  const n = Number(whole) + Number(frac) / Number(base);
  return neg ? -n : n;
}

export function abiString(x: string): string {
  if (!x || x.length < 130) return "";
  const n = parseInt(x.slice(66, 130), 16);
  if (!Number.isFinite(n) || n < 0 || n > 64) return "";
  let out = "";
  for (let i = 0; i < n; i++) out += String.fromCharCode(parseInt(x.substr(130 + i * 2, 2), 16));
  return out.replace(/\u0000/g, "").trim();
}

let rpcId = 1;

export async function rpc<T = any>(method: string, params: unknown[]): Promise<T> {
  const r = await fetch(ENV.rpc, {
    method: "POST",
    signal: AbortSignal.timeout(15000),
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: rpcId++, method, params }),
  });
  if (!r.ok) throw new Error(`rpc http ${r.status}`);
  const j = await r.json();
  if (j.error) throw new Error(j.error.message || "rpc error");
  return j.result as T;
}

/** JSON-RPC batch with a sequential fallback if the node rejects batches. */
export async function rpcBatch(calls: { method: string; params: unknown[] }[]): Promise<any[]> {
  if (calls.length === 0) return [];
  if (calls.length === 1) return [await rpc(calls[0].method, calls[0].params)];
  const base = rpcId;
  rpcId += calls.length;
  try {
    const r = await fetch(ENV.rpc, {
      method: "POST",
    signal: AbortSignal.timeout(15000),
      headers: { "content-type": "application/json" },
      body: JSON.stringify(calls.map((c, i) => ({ jsonrpc: "2.0", id: base + i, ...c }))),
    });
    const j = await r.json();
    if (!Array.isArray(j)) throw new Error("batch not supported");
    const byId = new Map<number, any>(j.map((x: any) => [x.id, x]));
    return calls.map((_, i) => {
      const x = byId.get(base + i);
      if (!x || x.error) throw new Error(x?.error?.message || "batch item failed");
      return x.result;
    });
  } catch {
    const out: any[] = [];
    for (const c of calls) out.push(await rpc(c.method, c.params));
    return out;
  }
}

export interface Log {
  address: string;
  topics: string[];
  data: string;
  blockNumber: string;
  transactionHash: string;
  logIndex: string;
  blockTimestamp?: string;
}

/**
 * eth_getLogs over [from, to], splitting the range in halves when the node
 * refuses it (block-range caps differ per provider: Alchemy free is 10).
 */
export async function getLogs(
  filter: { address: string; topics: (string | string[] | null)[] },
  from: number,
  to: number
): Promise<Log[]> {
  if (to < from) return [];
  if (to - from + 1 > ENV.logsRange) {
    const mid = from + ENV.logsRange - 1;
    return [...(await getLogs(filter, from, mid)), ...(await getLogs(filter, mid + 1, to))];
  }
  try {
    return await rpc<Log[]>("eth_getLogs", [{ ...filter, fromBlock: toHex(from), toBlock: toHex(to) }]);
  } catch (e) {
    if (to - from < 10) throw e;
    const mid = Math.floor((from + to) / 2);
    return [...(await getLogs(filter, from, mid)), ...(await getLogs(filter, mid + 1, to))];
  }
}

// Minimal request/response shapes so we do not depend on @vercel/node types.
export interface Req {
  method?: string;
  query: Record<string, string | string[] | undefined>;
}
export interface Res {
  setHeader(k: string, v: string): void;
  status(code: number): Res;
  json(body: unknown): void;
  end(): void;
}
