// Client for /api/chain. Talks only to our own origin.

export type ChainState = {
  ok: boolean;
  launched: boolean;
  chainId: number;
  block: number | null;
  token?: {
    address: string;
    name?: string;
    symbol?: string;
    decimals?: number;
    supply?: number | null;
    holders?: number | null;
  };
  launch?: {
    curve: string;
    pairToken: string;
    graduationThreshold: number;
    poolId: string;
    phase: "curve" | "graduated";
    quoteRaised: number | null;
    progress: number;
  };
  feed?: { birthBlock: number; chunkBlocks: number; headChunk: number };
  links: { site: string; x: string; pons: string; explorer: string };
  error?: string;
  updated: number;
};

const EMPTY: ChainState = {
  ok: false,
  launched: false,
  chainId: 4663,
  block: null,
  links: {
    site: "https://rattery.tech",
    x: "https://x.com/ratterytech",
    pons: "https://www.ponsfamily.com/launchpad",
    explorer: "https://robinhoodchain.blockscout.com",
  },
  updated: 0,
};

export async function fetchChain(): Promise<ChainState> {
  try {
    const r = await fetch("/api/chain", { cache: "no-store", signal: AbortSignal.timeout(15000) });
    if (!r.ok) return { ...EMPTY, error: `http ${r.status}` };
    // Plain `vite dev` has no /api and serves index.html: treat as pre-launch.
    if (!(r.headers.get("content-type") || "").includes("json")) return { ...EMPTY, error: "no api" };
    const s = await r.json() as ChainState;
    if (!s || typeof s.ok !== 'boolean' || typeof s.launched !== 'boolean' || ![4663,46630].includes(s.chainId) || !Number.isSafeInteger(s.updated) || s.updated < 0) throw new Error('Invalid chain response');
    if (s.ok && s.launched && (!s.token || !/^0x[0-9a-f]{40}$/i.test(s.token.address) || !s.feed || !Number.isSafeInteger(s.feed.birthBlock) || s.feed.birthBlock < 0 || !Number.isSafeInteger(s.feed.chunkBlocks) || s.feed.chunkBlocks < 1 || !Number.isSafeInteger(s.feed.headChunk) || s.feed.headChunk < 0)) throw new Error('Invalid live feed metadata');
    const links = {...EMPTY.links};
    for (const key of Object.keys(links) as (keyof typeof links)[]) {
      try { const url=new URL(s.links?.[key]); if(url.protocol==='https:' && !url.username && !url.password) links[key]=url.href; } catch { /* Keep trusted default. */ }
    }
    return {...s, links};
  } catch (e) {
    return { ...EMPTY, error: String((e as Error).message || e).slice(0, 160) };
  }
}

export function pollChain(onData: (s: ChainState) => void, ms = 15_000) {
  let stop = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const beat = async () => {
    if (stop) return;
    const s = await fetchChain();
    if (stop) return;
    onData(s);
    timer = setTimeout(beat, ms);
  };
  beat();
  return () => {
    stop = true;
    if (timer) clearTimeout(timer);
  };
}
