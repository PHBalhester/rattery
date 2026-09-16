/**
 * GET /api/chain
 *
 * Same-origin, read-only view of the RATTERY token for the HUD. The public
 * RPC intermittently sends a broken CORS header (`*,*`), so the browser never
 * talks to it directly. No keys, no wallet, no writes.
 *
 *   launched:false  until RATTERY_CA and RATTERY_BIRTH_BLOCK are set
 *   launched:true   token metadata, curve phase / graduation progress,
 *                   holders, and the feed cursor for /api/trades
 */
import { ENV, abiString, hexNum, rpcBatch, toFloat, type Req, type Res } from "./_lib/eth.js";
import { PONS, resolveLaunch } from "./_lib/pons.js";

const SITE = {
  site: "https://rattery.tech",
  x: "https://x.com/ratterytech",
  pons: "https://www.ponsfamily.com/launchpad",
  get explorer(){return ENV.blockscout;},
};

const SEL = {
  totalSupply: "0x18160ddd",
  symbol: "0x95d89b41",
  name: "0x06fdde03",
  decimals: "0x313ce567",
  balanceOf: "0x70a08231",
};

const balanceOfData = (holder: string) => SEL.balanceOf + holder.replace(/^0x/, "").padStart(64, "0");

const HOLDERS_TTL = 60_000;
let holdersKey="";
let holdersCache: { at: number; raw: number | null } = { at: 0, raw: null };

async function blockscoutHolders(token: string): Promise<number | null> {
  const key=`${ENV.chainId}:${ENV.blockscout}:${token}`;if(key!==holdersKey){holdersCache={at:0,raw:null};holdersKey=key;}
  const now = Date.now();
  if (now - holdersCache.at < HOLDERS_TTL) return holdersCache.raw;
  try {
    const r = await fetch(`${ENV.blockscout}/api/v2/tokens/${token}`, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(8000) });
    if (!r.ok) throw new Error(`blockscout ${r.status}`);
    const j = (await r.json()) as { holders_count?: string | number; holders?: string | number };
    const n = Number(j.holders_count ?? j.holders);
    holdersCache = { at: now, raw: Number.isSafeInteger(n) && n >= 0 ? n : null };
  } catch {
    holdersCache = { at: now, raw: holdersCache.raw }; // keep last good value, retry after TTL
  }
  return holdersCache.raw;
}

export default async function handler(req: Req, res: Res) {
  res.setHeader("Cache-Control", "public, s-maxage=15, stale-while-revalidate=60");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") { res.setHeader("Allow", "GET, OPTIONS"); return res.status(405).json({error:"Method not allowed"}); }
  const updated = Math.floor(Date.now() / 1000);

  let launch;
  try {
    launch = await resolveLaunch();
  } catch (e) {
    return res.status(200).json({
      ok: false, launched: true, chainId: ENV.chainId, links: SITE, updated,
      token: { address: ENV.ca }, error: String((e as Error).message || e).slice(0, 160),
    });
  }

  if (!launch) {
    // Pre-launch: honest emptiness. The site runs the demo tape.
    let block: number | null = null;
    try {
      block = hexNum((await rpcBatch([{ method: "eth_blockNumber", params: [] }]))[0]);
    } catch {
      /* chain unreachable is fine pre-launch */
    }
    return res.status(200).json({ ok: true, launched: false, chainId: ENV.chainId, block, links: SITE, updated });
  }

  const t = launch.token;
  const call = (data: string) => ({ method: "eth_call", params: [{ to: t, data }, "latest"] });
  const protocolHolders = [launch.curve, PONS.poolManager, PONS.locker, PONS.hook];

  try {
    const r = await rpcBatch([
      { method: "eth_blockNumber", params: [] },
      call(SEL.totalSupply),
      call(SEL.symbol),
      call(SEL.name),
      call(SEL.decimals),
      { method: "eth_getBalance", params: [launch.curve, "latest"] },
      ...protocolHolders.map((h) => call(balanceOfData(h))),
    ]);
    const [blk, sup, sym, nam, dec, curveEth, ...protoBal] = r;
    const decimals = hexNum(dec);
    if (!/^0x[0-9a-f]+$/i.test(dec ?? "") || !Number.isInteger(decimals) || decimals < 0 || decimals > 255) throw new Error("Invalid token decimals");
    const supply = toFloat(BigInt(sup || "0x0"), decimals);
    const curveTokens = toFloat(BigInt(protoBal[0] || "0x0"), decimals);

    // On the curve until it is swept: the curve holds the unsold supply.
    const onCurve = supply > 0 && curveTokens > supply * 0.005;
    const quoteRaised = toFloat(BigInt(curveEth || "0x0"), 18);
    const progress = onCurve ? Math.min(1, quoteRaised / (launch.graduationThreshold || 4.2)) : 1;

    // Blockscout counts every address with a balance, protocol contracts
    // included. Subtract the ones that actually hold the token right now.
    const raw = await blockscoutHolders(t);
    const protocolWithBalance = protoBal.filter((b: string) => BigInt(b || "0x0") > 0n).length;
    const holders = raw === null ? null : Math.max(0, raw - protocolWithBalance);

    const head = hexNum(blk);
    return res.status(200).json({
      ok: true,
      launched: true,
      chainId: ENV.chainId,
      block: head,
      token: { address: t, name: abiString(nam) || "RATTERY", symbol: abiString(sym) || "RATTERY", decimals, supply, holders },
      launch: {
        curve: launch.curve,
        pairToken: launch.pairToken,
        graduationThreshold: launch.graduationThreshold,
        poolId: launch.poolId,
        phase: onCurve ? "curve" : "graduated",
        quoteRaised: onCurve ? quoteRaised : null,
        progress,
      },
      feed: {
        birthBlock: launch.birthBlock,
        chunkBlocks: ENV.chunkBlocks,
        headChunk: Math.max(0, Math.floor((head - launch.birthBlock) / ENV.chunkBlocks)),
      },
      links: { ...SITE, pons: `${SITE.pons}/${t}`, explorer: `${SITE.explorer}/token/${t}` },
      updated,
    });
  } catch (e) {
    return res.status(200).json({
      ok: false, launched: true, chainId: ENV.chainId, links: SITE, updated,
      token: { address: t }, error: String((e as Error).message || e).slice(0, 160),
    });
  }
}
