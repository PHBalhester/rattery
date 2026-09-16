import { CONFIG } from "../config.js";
import type {
  DeathCause,
  Genome,
  Hormones,
  LifeStage,
  Pregnancy,
  Rat,
  Sex,
  World,
  WorldEnv,
  WorldEvent,
} from "../types.js";
import { chance, irange, pick, range, worldRng } from "./rng.js";
import { ZERO_H, clamp01, lerp } from "./hormones.js";

const SYL = ["ka", "ni", "ro", "ve", "lu", "sa", "mo", "te", "ri", "qo", "ba", "ul", "se", "dra"];
const FOUNDERS: { name: string; sex: Sex }[] = [
  { name: "Mora", sex: "F" },
  { name: "Nila", sex: "F" },
  { name: "Kest", sex: "M" },
  { name: "Rook", sex: "M" },
];

const NEST = { x: 800, y: 520, r: 70 };
export const EVENT_CAP = 300;

function genomeBase(): Genome {
  return {
    stressGain: 1,
    maternalInvest: 1,
    litterBias: 0,
    heatNeed: 1,
    fertility: 1,
  };
}

function hormonesFresh(): Hormones {
  return { ...ZERO_H };
}

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

function ageDays(r: Rat, simDay: number) {
  return simDay - r.bornAt;
}

export function stageOf(r: Rat, simDay: number): LifeStage {
  if (r.deadAt !== null) return "dead";
  const age = ageDays(r, simDay);
  if (age < CONFIG.bio.eyesOpenDay) return "neonate";
  if (age < CONFIG.bio.weanDay) return "juvenile";
  const mature = r.sex === "F" ? CONFIG.bio.femaleMatureDay : CONFIG.bio.maleMatureDay;
  if (age < mature) return "weanling";
  return "adult";
}

function makeName(rng: () => number, gen: number) {
  const a = pick(rng, SYL);
  const b = pick(rng, SYL);
  return `${a}${b}${gen}`;
}

export function pushEvent(world: World, ev: WorldEvent) {
  world.events.unshift(ev);
  if (world.events.length > EVENT_CAP) world.events.length = EVENT_CAP;
}

function allocId(world: World, prefix: string) {
  const n = world.nextId++;
  return `${prefix}${n}`;
}

export function inheritGenome(
  mom: Genome,
  dad: Genome,
  rng: () => number,
  conceivedStressed: boolean,
  conceivedFlush: boolean
): Genome {
  const mix = (a: number, b: number, jitter: number, lo: number, hi: number) =>
    clamp(lerp(a, b, 0.5) + (rng() - 0.5) * 2 * jitter, lo, hi);

  const g: Genome = {
    stressGain: mix(mom.stressGain, dad.stressGain, 0.08, 0.6, 1.6),
    maternalInvest: mix(mom.maternalInvest, dad.maternalInvest, 0.08, 0.5, 1.5),
    litterBias: mix(mom.litterBias, dad.litterBias, 0.4, -2, 2),
    heatNeed: mix(mom.heatNeed, dad.heatNeed, 0.06, 0.7, 1.3),
    fertility: mix(mom.fertility, dad.fertility, 0.06, 0.7, 1.3),
  };

  if (conceivedStressed) g.stressGain = clamp(g.stressGain + 0.15, 0.6, 1.6);
  if (conceivedFlush) g.litterBias = clamp(g.litterBias + 0.3, -2, 2);
  return g;
}

export function spawnRat(
  world: World,
  rng: () => number,
  args: {
    sex: Sex;
    bornAt: number;
    gen: number;
    motherId: string | null;
    fatherId: string | null;
    genome: Genome;
    x: number;
    y: number;
    energy: number;
    name?: string;
    stage?: LifeStage;
  }
): Rat {
  const r: Rat = {
    id: allocId(world, args.sex),
    name: args.name ?? makeName(rng, args.gen),
    sex: args.sex,
    bornAt: args.bornAt,
    deadAt: null,
    deathCause: "none",
    gen: args.gen,
    motherId: args.motherId,
    fatherId: args.fatherId,
    genome: args.genome,
    hormones: hormonesFresh(),
    energy: clamp01(args.energy),
    heat: 0.6,
    x: args.x,
    y: args.y,
    vx: 0,
    vy: 0,
    stage: args.stage ?? "neonate",
    cycle: "diestrus",
    cycleT: range(rng, 0, CONFIG.bio.cycleDays),
    pregnant: null,
    nursing: [],
    lastBirthAt: null,
    postpartumWindow: false,
    inNest: true,
    retrieving: null,
    offspring: 0,
  };
  world.rats[r.id] = r;
  return r;
}

export function kill(world: World, r: Rat, cause: DeathCause) {
  if (r.deadAt !== null) return;
  r.deadAt = world.simDay;
  r.deathCause = cause;
  r.stage = "dead";
  r.vx = 0;
  r.vy = 0;
  r.retrieving = null;
  r.pregnant = null;

  if (r.motherId && world.rats[r.motherId]) {
    const m = world.rats[r.motherId];
    m.nursing = m.nursing.filter((id) => id !== r.id);
  }
  // Her pups become orphans: neonatalRisk / energyStep see the dead mother.
  r.nursing = [];

  // Preserve identity separately from the active population and biological scans.
  (world.memorial??={})[r.id]={id:r.id,name:r.name,sex:r.sex,bornAt:r.bornAt,deadAt:r.deadAt,deathCause:r.deathCause,gen:r.gen,motherId:r.motherId,fatherId:r.fatherId,offspring:r.offspring};
  world.totals.deaths += 1;
  pushEvent(world, { t: world.simDay, kind: "death", ratId: r.id, extra: cause });

  // Prune: only founders and dams with offspring are lineage. Everyone else
  // leaves the world map, so per-tick scans stay proportional to the nest
  // instead of to everyone who ever lived.
  if (r.gen > 0 && r.offspring === 0) delete world.rats[r.id];
}

export function aliveRats(world: World): Rat[] {
  const out: Rat[] = [];
  for (const id in world.rats) {
    const r = world.rats[id];
    if (r.deadAt === null) out.push(r);
  }
  return out;
}

export function dist(a: { x: number; y: number }, b: { x: number; y: number }) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.hypot(dx, dy);
}

export function inNest(r: Rat) {
  return dist(r, NEST) <= NEST.r + 8;
}

export function nestJitter(rng: () => number) {
  const ang = rng() * Math.PI * 2;
  const rad = rng() * (NEST.r * 0.55);
  return { x: NEST.x + Math.cos(ang) * rad, y: NEST.y + Math.sin(ang) * rad };
}

export function tryConceive(
  world: World,
  rng: () => number,
  dam: Rat,
  sire: Rat,
  p: number,
  env: WorldEnv
): boolean {
  if (dam.pregnant || dam.sex !== "F") return false;
  if (!chance(rng, clamp01(p))) return false;

  const gest = range(rng, CONFIG.bio.gestationMin, CONFIG.bio.gestationMax);
  const planned = irange(rng, CONFIG.bio.litterMin, CONFIG.bio.litterMax);
  const stressed = env.stress > 0.7;
  const flush = env.food > 0.75;
  const preg: Pregnancy = {
    sireId: sire.id,
    sireGenome: { ...sire.genome },
    conceivedAt: world.simDay,
    dueAt: world.simDay + gest,
    plannedLitter: planned,
    conceivedStressed: stressed,
    conceivedFlush: flush,
  };
  dam.pregnant = preg;
  dam.postpartumWindow = false;

  const tag = stressed ? "crash" : flush ? "flush" : "ok";
  pushEvent(world, {
    t: world.simDay,
    kind: "conceive",
    ratId: dam.id,
    extra: `${sire.name}:${tag}`,
  });
  return true;
}

export function deliverLitter(world: World, rng: () => number, dam: Rat, env: WorldEnv) {
  const preg = dam.pregnant;
  if (!preg) return;

  // Birth conditions (today's market) shape size and birth weight...
  const stressedNow = env.stress > 0.7;
  const flushNow = env.food > 0.75;

  const raw =
    preg.plannedLitter +
    dam.genome.litterBias +
    irange(rng, -1, 1) -
    Math.floor(dam.hormones.cort * 3) -
    Math.floor((1 - env.food) * 2);

  const litterN = clamp(Math.round(raw), 3, 14);
  const stillP = clamp01(0.04 + dam.hormones.cort * 0.12 + (1 - env.food) * 0.1);

  dam.pregnant = null;
  dam.lastBirthAt = world.simDay;
  dam.postpartumWindow = false;
  dam.hormones.ot = 1;
  dam.hormones.prl = clamp01(dam.hormones.prl + 0.35);
  dam.inNest = true;
  dam.x = lerp(dam.x, NEST.x, 0.6);
  dam.y = lerp(dam.y, NEST.y, 0.6);

  let live = 0;
  for (let i = 0; i < litterN; i++) {
    if (chance(rng, stillP)) {
      pushEvent(world, { t: world.simDay, kind: "stillbirth", ratId: dam.id });
      continue;
    }
    const pos = nestJitter(rng);
    const sex: Sex = chance(rng, 0.5) ? "F" : "M";
    const energy = clamp01((flushNow ? 0.75 : 0.58) - (stressedNow ? 0.1 : 0) + (rng() - 0.5) * 0.08);
    const pup = spawnRat(world, rng, {
      sex,
      bornAt: world.simDay,
      gen: dam.gen + 1,
      motherId: dam.id,
      fatherId: preg.sireId,
      // ...while the epigenetic tags come from the market at conception,
      // as the footer promises ("litters conceived in a crash").
      genome: inheritGenome(dam.genome, preg.sireGenome, rng, preg.conceivedStressed, preg.conceivedFlush),
      x: pos.x,
      y: pos.y,
      energy,
      stage: "neonate",
    });
    dam.nursing.push(pup.id);
    live += 1;
  }

  dam.offspring += live;
  world.totals.litters += 1;
  world.totals.pups += live;
  world.lastBirth = { ratId: dam.id, t: world.simDay };

  pushEvent(world, {
    t: world.simDay,
    kind: "birth",
    ratId: dam.id,
    extra: `${live}/${litterN}`,
  });

  enforceCap(world);
}

/** Weaning = leaving the mother's nursing list at weanDay. Fires once. */
export function weanIfDue(world: World, pup: Rat, mother: Rat | undefined) {
  if (pup.deadAt !== null) return;
  if (ageDays(pup, world.simDay) < CONFIG.bio.weanDay) return;
  if (mother && mother.nursing.includes(pup.id)) {
    mother.nursing = mother.nursing.filter((id) => id !== pup.id);
    pushEvent(world, { t: world.simDay, kind: "wean", ratId: pup.id });
  }
}

export function resumeCycleIfClear(dam: Rat) {
  if (dam.sex !== "F" || dam.pregnant) return;
  if (dam.nursing.length === 0 && dam.cycle === "anestrus_lactational") {
    dam.cycle = "diestrus";
    dam.cycleT = 0;
    dam.postpartumWindow = false;
  }
}

/**
 * Crowding cull, in tiers, until the colony is back under maxAlive:
 *   1. weanlings wandering outside the nest (oldest first)
 *   2. any weanling
 *   3. non-breeding adults (not pregnant, not nursing), oldest first, founders last
 *   4. anyone else old enough to leave the nest
 * Pups are never culled directly (their mothers carry that cost) and a dam is
 * only taken once nothing else is left.
 */
export function enforceCap(world: World) {
  const living = aliveRats(world);
  let extra = living.length - CONFIG.colony.maxAlive;
  if (extra <= 0) return;

  const oldestFirst = (a: Rat, b: Rat) => a.bornAt - b.bornAt || (a.id < b.id ? -1 : 1);
  const breeding = (r: Rat) => !!r.pregnant || r.nursing.length > 0;
  const isPup = (r: Rat) => r.stage === "neonate" || r.stage === "juvenile";

  const tiers: Rat[][] = [
    living.filter((r) => r.stage === "weanling" && !inNest(r)).sort(oldestFirst),
    living.filter((r) => r.stage === "weanling" && inNest(r)).sort(oldestFirst),
    living
      .filter((r) => r.stage === "adult" && !breeding(r))
      .sort((a, b) => Number(a.gen === 0) - Number(b.gen === 0) || oldestFirst(a, b)),
    living.filter((r) => r.stage === "adult" && breeding(r)).sort(oldestFirst),
  ];
  for (const tier of tiers) {
    for (const r of tier) {
      if (extra <= 0) return;
      if (r.deadAt !== null || isPup(r)) continue;
      kill(world, r, "crowding");
      extra -= 1;
    }
  }
}

export function createWorld(seed = CONFIG.colony.seed): World {
  const world: World = {
    simDay: 0,
    realStartedAt: Date.now(),
    rats: {},
    env: {
      food: 0.55,
      warmth: 0.55,
      water: 0.62,
      stress: 0.25,
      dopaminePulse: 0.1,
      lastTradeAt: Date.now(),
      buyPressure: 0.2,
      sellPressure: 0.2,
      holdersApprox: 2,
      forage: 0,
      panic: 0,
    },
    events: [],
    nextId: 1,
    seed,
    rngState: seed | 0,
    totals: { litters: 0, pups: 0, deaths: 0 },
    lastBirth: null,
    blackout: false,
    extinct: false,
  };
  // One stream for the whole life of the world, founders included.
  const rng = worldRng(world);

  const slots = [
    { x: NEST.x - 30, y: NEST.y + 10 },
    { x: NEST.x + 28, y: NEST.y + 8 },
    { x: NEST.x - 70, y: NEST.y - 40 },
    { x: NEST.x + 74, y: NEST.y - 36 },
  ];

  FOUNDERS.forEach((f, i) => {
    const g = genomeBase();
    g.stressGain = range(rng, 0.85, 1.15);
    g.maternalInvest = range(rng, 0.9, 1.2);
    g.fertility = range(rng, 0.95, 1.15);
    spawnRat(world, rng, {
      sex: f.sex,
      bornAt: -60,
      gen: 0,
      motherId: null,
      fatherId: null,
      genome: g,
      x: slots[i].x,
      y: slots[i].y,
      energy: 0.8,
      name: f.name,
      stage: "adult",
    });
  });

  return world;
}

export const NEST_POS = NEST;
