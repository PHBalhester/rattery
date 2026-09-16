import { create } from "zustand";
import {localCareLab} from "./localCareGate";
import { CONFIG } from "./config";
import { fetchSnapshot } from "./market/snapshot";
import type { ColonySnapshot } from "./sim/snapshot";
import type { Trade, World } from "./types";
import type { FeedStatus } from "./market/types";
import { worldRng } from "./sim/rng";
import { createWorld } from "./sim/colony";
import { tick } from "./sim/tick";
import { applyTrade } from "./sim/marketMap";
import { makeReplay, tagNewHolders } from "./sim/replay";
import { marketBus } from "./market/bus";
import { startDemoFeed } from "./market/demo";
import { fetchAllHistory, HistoryLimitError, startOnchainLive } from "./market/onchain";
import { pollChain, type ChainState } from "./market/chain";

const TAPE_CAP = 30;
let queuedTape:Trade[]|null=null;
let tapeTimer:ReturnType<typeof setTimeout>|null=null;
function clearQueuedTape(){if(tapeTimer!==null)clearTimeout(tapeTimer);tapeTimer=null;queuedTape=null;}
// Cap catch-up so a backgrounded tab does not run thousands of ticks on return.
const MAX_CATCHUP_TICKS = 20;
// Feature 2: genesis-replay safety cap (~500 sim-days, about 8 real hours of
// token age at 1 sim-day = 60s). A freshly launched token never hits it for
// hours; past it the colony stops aging faster than a server snapshot could
// restore. See src/sim/replay.ts.
const MAX_REPLAY_TICKS = 300_000;
// Ticks replayed per animation frame during catch-up. Keeps the tab responsive
// and lets the 3D show the colony fast-forwarding into being.
const REPLAY_BATCH = 100;

const dtDaysPerTick = CONFIG.time.tickMs / CONFIG.time.realMsPerSimDay;

// ---------------------------------------------------------------------------
// Engine state lives outside React. The world is a single mutable object and
// its RNG state is a field on it (world.rngState), so the same seed + the same
// trade sequence reproduces the same colony, and a JSON snapshot is complete.
// ---------------------------------------------------------------------------
let world: World = createWorld(CONFIG.colony.seed);
let rng: () => number = worldRng(world);

const pendingTrades: Trade[] = [];
let rafId: number | null = null;
let acc = 0;
let lastFrame = 0;
let started = false;

let stopFeed: (() => void) | null = null;
let stopChain: (() => void) | null = null;
let unsubBus: (() => void) | null = null;

let feedMode: "none" | "demo" | "live" = "none";
type Phase = "idle" | "catchup" | "live" | "blocked";
let phase: Phase = "idle";
let replay: ReturnType<typeof makeReplay> | null = null;
let replayStartTick = 0;

export function getWorld(): World {
  return world;
}

interface StoreState {
  version: number; // bumped each sim-tick to nudge React re-renders
  cinema: boolean;
  focusedId: string | null;
  trades: Trade[]; // newest first, capped at TAPE_CAP for the tape
  feedStatus: FeedStatus;
  chain: ChainState | null;
  catchupPct: number; // 0..100 while phase === "catchup"
  toggleCinema: () => void;
  focus: (id: string | null) => void;
}

export const useStore = create<StoreState>((set) => ({
  version: 0,
  cinema: false,
  focusedId: null,
  trades: [],
  feedStatus: "idle",
  chain: null,
  catchupPct: 0,
  toggleCinema: () => set((s) => ({ cinema: !s.cinema })),
  focus: (id) => set({ focusedId: id }),
}));

// Browsers suspend RAF in background tabs. Rebuild the live world on return
// instead of silently dropping elapsed time through the bounded frame catch-up.
let hiddenAt:number|null=null;
function onVisibilityChange(){
 if(document.hidden){hiddenAt=Date.now();return;}
 const elapsed=hiddenAt===null?0:Date.now()-hiddenAt;hiddenAt=null;
 if(elapsed<=CONFIG.time.tickMs*MAX_CATCHUP_TICKS||feedMode!=='live')return;
 feedGeneration++;stopFeed?.();stopFeed=null;stopChain?.();
 replay=null;liveStart=null;phase='idle';pendingTrades.length=0;clearQueuedTape();
 useStore.setState({feedStatus:'connecting'});
 stopChain=pollChain(onChain);
}

/** Contract address as known by the server (empty before launch). */
export function useCA(): string {
  return useStore((s) => (s.chain?.launched ? s.chain.token?.address ?? "" : ""));
}

function resetWorld() {
  clearQueuedTape();
  world = createWorld(CONFIG.colony.seed);
  rng = worldRng(world);
  pendingTrades.length = 0;
  acc = 0;
}

// Push a trade onto the tape (newest first). Used for both feeds.
function pushTape(t: Trade) {
  queuedTape = [t, ...(queuedTape??useStore.getState().trades)].slice(0,TAPE_CAP);
  // Only batch presentation. Every trade still enters the simulation immediately.
  if(tapeTimer===null)tapeTimer=setTimeout(()=>{const trades=queuedTape;tapeTimer=null;queuedTape=null;if(trades)useStore.setState({trades});},200);
}

function startDemo() {
  resetWorld();
  phase = "live";
  useStore.setState({ trades: [], focusedId: null, feedStatus: "demo", catchupPct: 100 });
  const holders = new Set<string>();
  const seen = new Set<string>();
  stopFeed = startDemoFeed((t) => {
    if (seen.has(t.id)) return;
    seen.add(t.id);
    if(seen.size>4096)seen.delete(seen.values().next().value!);
    const isNewHolder = t.isNewHolder || !holders.has(t.trader);
    holders.add(t.trader);
    if(holders.size>4096)holders.delete(holders.values().next().value!);
    marketBus.emit({ ...t, isNewHolder });
  });
}

let enteringLive=false;
let feedGeneration=0;
async function enterLive(s: ChainState) {
  if (!s.feed) return;
  phase = "idle";
  useStore.setState({ feedStatus: "catchup", trades: [], focusedId: null, catchupPct: 0 });

  if(enteringLive)return;
  const generation=feedGeneration;
  enteringLive=true;
  let history:Awaited<ReturnType<typeof fetchAllHistory>>;
  let snapshot: ColonySnapshot | null = null;
  try {
    snapshot = await fetchSnapshot({chainId:s.chainId,token:s.token!.address,birthBlock:s.feed.birthBlock});
    if (feedMode !== "live" || generation !== feedGeneration) return;
    if (snapshot) {
      const target=Math.max(0,Math.floor((Date.now()-snapshot.t0)/CONFIG.time.tickMs));
      if(target < snapshot.cursor.tick)throw new Error("Snapshot is from the future");
      if(target-snapshot.cursor.tick>MAX_REPLAY_TICKS)throw new HistoryLimitError();
      const fromBlock=snapshot.cursor.lastKey<0?s.feed.birthBlock:Math.floor(snapshot.cursor.lastKey/100000);
      const fromChunk=Math.floor((fromBlock-s.feed.birthBlock)/s.feed.chunkBlocks);
      history=await fetchAllHistory(s.feed.headChunk,{fromChunk,afterKey:snapshot.cursor.lastKey});
      history.t0=snapshot.t0;
    } else history = await fetchAllHistory(s.feed.headChunk, { minTimestamp: Date.now() - MAX_REPLAY_TICKS * CONFIG.time.tickMs });
  } catch (error) {
    if (feedMode === 'live' && generation === feedGeneration) {
      if (error instanceof HistoryLimitError) {
        resetWorld();
        phase = 'blocked';
        useStore.setState({ feedStatus: 'history-limit', trades: [], catchupPct: 0 });
      } else useStore.setState({ feedStatus: 'error' });
    }
    return;
  } finally { enteringLive = false; }
  const {trades,t0}=history;
  if (feedMode !== "live"||generation!==feedGeneration) return; // mode flipped back while we were fetching

  // Number holders across the whole history, in order, exactly as the live
  // orchestrator does; keep the set so the live tail keeps counting from here.
  const holders = tagNewHolders(trades,new Set(snapshot?.holders??[]));

  resetWorld();
  if(snapshot){world=snapshot.world;rng=worldRng(world);}
  replayStartTick=snapshot?.cursor.tick??0;
  const targetTick = Math.max(0, Math.floor((Date.now() - t0) / CONFIG.time.tickMs));
  if (targetTick-replayStartTick > MAX_REPLAY_TICKS) {
    // Never claim a live colony after silently dropping unprocessed history.
    phase = "blocked";
    replay = null;
    liveStart = null;
    useStore.setState({ feedStatus: "history-limit", catchupPct: 0, trades: [] });
    return;
  }
  try { replay = makeReplay(world, rng, trades, {
    t0,
    targetTick,
    tickMs: CONFIG.time.tickMs,
    dtDays: dtDaysPerTick,
    maxTicks: MAX_REPLAY_TICKS,
    resume:snapshot?.cursor,
  }); } catch { phase="idle";useStore.setState({feedStatus:"error"});return; }

  // Seed the tape with the most recent slice of history (newest first).
  useStore.setState({ trades: trades.slice(-TAPE_CAP).reverse() });

  // Stash what the live tail needs once catch-up finishes.
  liveStart = { headChunk: s.feed.headChunk, holders };
  phase = "catchup";
}

let liveStart: { headChunk: number; holders: Set<string> } | null = null;

function startLiveTail() {
  if (!liveStart || !replay) return;
  const { headChunk, holders } = liveStart;
  const startKey = replay.lastKey();
  stopFeed = startOnchainLive({
    startChunk: headChunk,
    startKey,
    holders,
    onTrade: (t) => marketBus.emit(t),
    onStatus: (st) => useStore.setState({ feedStatus: st }),
  });
  useStore.setState({ feedStatus: "live" });
}

function onChain(s: ChainState) {
  if(!s.ok&&(s.launched||feedMode==='live')){useStore.setState({feedStatus:'error'});return;}
  const previous=useStore.getState().chain;
  const changed=previous?.chainId!==s.chainId||previous?.token?.address!==s.token?.address;
  useStore.setState({ chain: s });
  const mode = s.launched && s.feed ? "live" : "demo";
  if (mode === feedMode&&!changed) {if(mode==='live'&&phase==='idle'&&!enteringLive)void enterLive(s);return;}
  feedMode = mode;
  clearQueuedTape();
  feedGeneration++;

  // Tear down whatever feed was running; the world is rebuilt per mode.
  stopFeed?.();
  stopFeed = null;
  replay = null;
  liveStart = null;

  if (mode === "demo") startDemo();
  else void enterLive(s);
}

/**
 * Boot the simulation once. Guarded so React StrictMode's double-mount in dev
 * does not start two loops or two feeds.
 */
function startSharedObserver(){
 let stopped=false,lastRevision=-1,timer:ReturnType<typeof setTimeout>|undefined,controller:AbortController|undefined;
 useStore.setState({feedStatus:'connecting'});
 const poll=async()=>{
  controller=new AbortController();
  try{
   const response=await fetch('/api/colony',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}',signal:AbortSignal.any([controller.signal,AbortSignal.timeout(4000)])});
   if(!response.ok)throw Error('Snapshot unavailable');
   const snapshot=await response.json();
   if(!Number.isSafeInteger(snapshot.revision)||!snapshot.world?.rats||!Number.isFinite(snapshot.world.simDay)||typeof snapshot.version!=='string')throw Error('Invalid snapshot');
   if(!stopped&&snapshot.revision>lastRevision){
    world=snapshot.world;lastRevision=snapshot.revision;
    // Observers never tick or apply trades locally. All biology comes from the worker.
    useStore.setState(s=>({version:s.version+1,feedStatus:'live',catchupPct:100}));
   }
  }catch{if(!stopped)useStore.setState({feedStatus:'error'});}
  finally{if(!stopped)timer=setTimeout(poll,500);}
 };
 stopFeed=()=>{stopped=true;if(timer)clearTimeout(timer);controller?.abort();};
 void poll();
}

export function startEngine() {
  if (started) return;
  started = true;
  if(localCareLab&&new URLSearchParams(location.search).get('view')==='shared-colony'){startSharedObserver();return;}
  hiddenAt=document.hidden?Date.now():null;
  document.addEventListener("visibilitychange",onVisibilityChange);

  // Every non-backlog trade reaches the tape and (in live phase) the nest.
  unsubBus = marketBus.on((t) => {
    if (phase === "live" && !t.backlog) pendingTrades.push(t);
    pushTape(t);
  });

  // The feed starts once we know whether the token is live.
  stopChain = pollChain(onChain);

  lastFrame = performance.now();

  const frame = (now: number) => {
    const elapsed = now - lastFrame;
    lastFrame = now;

    if (phase === "catchup" && replay) {
      // Fast-forward the shared history in bounded batches so the tab stays
      // responsive and the 3D shows the colony materializing.
      replay.step(REPLAY_BATCH);
      const pct = Math.min(100, Math.round(((replay.reached()-replayStartTick) / Math.max(1, replay.target-replayStartTick)) * 100));
      useStore.setState((st) => ({ version: st.version + 1, catchupPct: pct }));
      if (replay.done()) {
        phase = "live";
        acc = 0;
        lastFrame = now;
        useStore.setState({ catchupPct: 100 });
        startLiveTail();
      }
      rafId = requestAnimationFrame(frame);
      return;
    }

    if (phase === "live") {
      // 1. Apply pending trades to the environment the instant they arrive.
      if (pendingTrades.length) {
        for (const t of pendingTrades) world.env = applyTrade(world.env, t);
        pendingTrades.length = 0;
      }
      // 2. Advance biology in fixed sim-ticks (with bounded catch-up).
      acc += elapsed;
      let ticksThisFrame = 0;
      while (acc >= CONFIG.time.tickMs && ticksThisFrame < MAX_CATCHUP_TICKS) {
        tick(world, dtDaysPerTick, rng);
        acc -= CONFIG.time.tickMs;
        ticksThisFrame += 1;
      }
      if (acc > CONFIG.time.tickMs * MAX_CATCHUP_TICKS) acc = 0;
      // 3. Nudge React (HUD, tree, overlay) at tick cadence, not every frame.
      if (ticksThisFrame > 0) useStore.setState((st) => ({ version: st.version + 1 }));
    }

    rafId = requestAnimationFrame(frame);
  };
  rafId = requestAnimationFrame(frame);
}

export function stopEngine() {
  document.removeEventListener("visibilitychange",onVisibilityChange);hiddenAt=null;
  clearQueuedTape();
  if (rafId !== null) cancelAnimationFrame(rafId);
  rafId = null;
  stopFeed?.();
  stopChain?.();
  unsubBus?.();
  stopFeed = null;
  stopChain = null;
  unsubBus = null;
  feedMode = "none";
  phase = "idle";
  replay = null;
  liveStart = null;
  started = false;
  feedGeneration++;
}
