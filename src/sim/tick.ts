import {identity,COAT_BUCKETS} from './ratIdentity.js';
import {familyNest} from './familyNest.js';
import {separateRats} from "./separation.js";
import {ecologyStep,individualStress} from './ecology.js';
import {socialStep} from "./social.js";
import { CONFIG } from "../config.js";
import type { Rat, World, WorldEnv } from "../types.js";
import {
  NEST_POS,
  aliveRats,
  deliverLitter,
  dist,
  enforceCap,
  inNest,
  kill,
  pushEvent,
  resumeCycleIfClear,
  stageOf,
  tryConceive,
  weanIfDue,
} from "./colony.js";
import { driveCycleHormones, phaseFromCycleT, pregnancyHormones, clamp01, lerp } from "./hormones.js";
import { decayEnv } from "./marketMap.js";
import { applyHabitatActivity } from "./habitatActivity.js";

const W = CONFIG.colony.burrowWidth;
const H = CONFIG.colony.burrowHeight;
const NEST = NEST_POS;

function nearestAdultMale(living: Rat[], r: Rat, maxD: number): Rat | null {
  let best: Rat | null = null;
  let bestD = maxD;
  for (const m of living) {
    if (m.deadAt !== null || m.sex !== "M" || m.stage !== "adult" || m.energy < 0.3) continue;
    const d = dist(r, m);
    if (d < bestD) {
      best = m;
      bestD = d;
    }
  }
  return best;
}

function wander(r: Rat, rng: () => number, attractNest: number, speed: number, jitter = 18) {
  r.vx += (rng() - 0.5) * jitter;
  r.vy += (rng() - 0.5) * jitter;
  const home=familyNest(r);
  r.vx += (home.x - r.x) * attractNest;
  r.vy += (home.y - r.y) * attractNest;
  const sp = Math.hypot(r.vx, r.vy) || 1;
  if (sp > speed) {
    r.vx = (r.vx / sp) * speed;
    r.vy = (r.vy / sp) * speed;
  }
  r.vx *= 0.86;
  r.vy *= 0.86;
  r.x = Math.max(40, Math.min(W - 40, r.x + r.vx));
  r.y = Math.max(40, Math.min(H - 40, r.y + r.vy));
}

/** A pup only drinks if its mother is alive and still lists it as hers. */
function nursedBy(pup: Rat, mother: Rat | undefined): mother is Rat {
  return !!mother && mother.deadAt === null && mother.nursing.includes(pup.id);
}

function energyStep(r: Rat, env: WorldEnv, dt: number, mother: Rat | undefined) {
  const bio = CONFIG.bio;
  if (r.stage === "neonate" || r.stage === "juvenile") {
    // Milk used to flow from motherId alone, so orphans and rejected pups kept
    // feeding. Now: only a living, nursing mother, and a starving dam gives less.
    const milk = nursedBy(r, mother) ? Math.min(1, mother.energy / 0.2) : 0;
    let gain = 0.18 * (env.food * 0.5 + 0.5) * milk * dt;
    // Eyes-open pups start nibbling solid food before weaning.
    if (r.stage === "juvenile") gain += env.food * bio.forageGain * bio.juvenileForage * dt;
    const drain =
      bio.basalCostPup * (1 + 0.8 * (1 - env.food) + 0.9 * (1 - env.warmth) * r.genome.heatNeed) * dt;
    r.energy = clamp01(r.energy + gain - drain);
    return;
  }

  let drain = bio.basalCostAdult * (1 + 0.5 * (1 - env.food) + 0.3 * (1 - env.warmth)) * dt;
  if (r.nursing.length) {
    drain += bio.lactationCostPerPup * r.nursing.length * (2 - r.genome.maternalInvest) * dt;
  }
  if (r.pregnant) drain += 0.06 * dt;
  const hydration = env.water ?? 0.55;
  drain += Math.max(0, 0.32 - hydration) * 0.045 * dt;
  const gain = env.food * bio.forageGain * (0.7 + hydration * 0.3) * dt;
  r.energy = clamp01(r.energy + gain - drain);
}

function heatStep(r: Rat, env: WorldEnv) {
  const nest = inNest(r);
  r.heat = clamp01(env.warmth * 0.8 + (nest ? 0.25 : 0) - (r.genome.heatNeed - 1) * 0.15);
  r.inNest = nest;
}

function neonatalRisk(
  world: World,
  rng: () => number,
  pup: Rat,
  mother: Rat | undefined,
  env: WorldEnv,
  dt: number
) {
  if (pup.deadAt !== null) return;
  if (pup.stage !== "neonate") return;
  const age = world.simDay - pup.bornAt;

  if (pup.energy <= 0) {
    kill(world, pup, pup.inNest ? "starvation" : "neonatal_abandon");
    return;
  }
  if (pup.heat < 0.12) {
    kill(world, pup, "cold");
    return;
  }

  // Orphaned, or rejected by a dam that is still alive.
  if (!nursedBy(pup, mother)) {
    if (rng() < 0.25 * dt) kill(world, pup, "neonatal_abandon");
    return;
  }

  if (age < 3 && mother.hormones.cort > 0.8 && env.food < 0.25) {
    const abandonP = 0.15 * mother.hormones.cort * (1 - mother.genome.maternalInvest) * dt;
    const cannibalP =
      0.06 * mother.hormones.cort * (1 - env.food) * (1 - mother.genome.maternalInvest) * dt;
    if (rng() < cannibalP) {
      pushEvent(world, { t: world.simDay, kind: "cannibal", ratId: mother.id, extra: pup.id });
      kill(world, pup, "neonatal_cannibal");
      mother.energy = clamp01(mother.energy + 0.04);
      return;
    }
    if (rng() < abandonP) {
      pushEvent(world, { t: world.simDay, kind: "reject_nest", ratId: mother.id, extra: pup.id });
      pup.x += (rng() - 0.5) * 160;
      pup.y += (rng() - 0.5) * 160;
      mother.nursing = mother.nursing.filter((id) => id !== pup.id);
    }
  }
}

/** Pups cannot walk home before their eyes open; mothers fetch them. */
function pupMovement(r: Rat, rng: () => number) {
  const NEST=familyNest(r);
  if (r.stage === "neonate") {
    // In the nest they huddle toward the centre; outside it they stay put
    // (cold, and waiting for a retrieval that a rejecting dam will not make).
    if (inNest(r)) {
      r.x = lerp(r.x, NEST.x + (r.x - NEST.x) * 0.92, 0.08);
      r.y = lerp(r.y, NEST.y + (r.y - NEST.y) * 0.92, 0.08);
    }
    return;
  }
  // Juveniles (eyes open) explore on a loose leash and can stray past the
  // retrieval radius (90px), which is what triggers a dam to fetch them.
  wander(r, rng, 0.002, 1.6);
}

function retrieveStep(world: World, dam: Rat) {
  const NEST=familyNest(dam);
  dam.retrieving = null;
  if (dam.sex !== "F" || dam.stage !== "adult" || dam.energy < 0.25) return;
  if (dam.hormones.cort >= 0.7) return;
  if (dam.genome.maternalInvest < 0.7) return;

  for (const id of dam.nursing) {
    const pup = world.rats[id];
    if (!pup || pup.deadAt !== null) continue;
    if (dist(pup, NEST) > 90) {
      dam.retrieving = pup.id;
      const dx = pup.x - dam.x;
      const dy = pup.y - dam.y;
      const d = Math.hypot(dx, dy) || 1;
      dam.x += (dx / d) * 4.2;
      dam.y += (dy / d) * 4.2;
      if (dist(dam, pup) < 16) {
        pup.x = NEST.x + (pup.x - NEST.x) * 0.15;
        pup.y = NEST.y + (pup.y - NEST.y) * 0.15;
        pup.vx = 0;
        pup.vy = 0;
        dam.retrieving = null;
        pushEvent(world, { t: world.simDay, kind: "retrieve", ratId: dam.id, extra: pup.id });
      }
      return;
    }
  }
}

function cycleAndMate(
  world: World,
  rng: () => number,
  dam: Rat,
  env: WorldEnv,
  dt: number,
  living: Rat[]
) {
  if (dam.sex !== "F" || dam.stage !== "adult" || dam.deadAt !== null) return;

  if (dam.pregnant) {
    const preg = dam.pregnant;
    const day = world.simDay - preg.conceivedAt;
    const total = preg.dueAt - preg.conceivedAt;
    pregnancyHormones(dam.hormones, day, total, env.stress * dam.genome.stressGain, dt);
    if (world.simDay >= preg.dueAt) deliverLitter(world, rng, dam, env);
    return;
  }

  const hoursSinceBirth = dam.lastBirthAt === null ? Infinity : (world.simDay - dam.lastBirthAt) * 24;

  const inPP =
    dam.lastBirthAt !== null &&
    hoursSinceBirth >= CONFIG.bio.postpartumEstrusStartH &&
    hoursSinceBirth <= CONFIG.bio.postpartumEstrusEndH;

  if (dam.nursing.length && dam.lastBirthAt !== null) {
    if (inPP) {
      if (!dam.postpartumWindow) {
        dam.postpartumWindow = true;
        dam.cycle = "estrus";
        pushEvent(world, { t: world.simDay, kind: "estrus", ratId: dam.id, extra: "postpartum" });
        const sire = nearestAdultMale(living, dam, 220);
        if (sire) {
          const p =
            CONFIG.bio.postpartumFertileP * dam.genome.fertility * (1 - dam.hormones.cort * 0.6) * env.food;
          tryConceive(world, rng, dam, sire, p, env);
        }
      }
    } else if (hoursSinceBirth > CONFIG.bio.postpartumEstrusEndH) {
      dam.postpartumWindow = false;
      if (!dam.pregnant) dam.cycle = "anestrus_lactational";
    }
    return;
  }

  dam.cycleT += dt * (1 - dam.hormones.cort * 0.25);
  dam.cycle = phaseFromCycleT(dam.cycleT, CONFIG.bio.cycleDays);
  if (dam.cycle === "estrus") {
    const sire = nearestAdultMale(living, dam, 120);
    if (sire && env.food > 0.28 && dam.hormones.cort < 0.75) {
      const p = 0.35 * dam.genome.fertility * dt * 4;
      tryConceive(world, rng, dam, sire, p, env);
    }
  }
}

function deathChecks(world: World, r: Rat) {
  if (r.deadAt !== null) return;
  if (r.energy <= 0) {
    kill(world, r, r.stage === "neonate" ? (r.inNest ? "starvation" : "neonatal_abandon") : "starvation");
    return;
  }
  if (world.simDay - r.bornAt > CONFIG.bio.lifespanDays) kill(world, r, "age");
}

/**
 * One fixed step. `rng` must be worldRng(world) so the stream travels with
 * the world. `dtDays` = CONFIG.time.simDaysPerTick. Trades are applied to
 * world.env by the caller before the tick; this applies the silence decay.
 */
export function tick(world: World, dtDays: number, rng: () => number, envOverride?: WorldEnv): World {
  for(const r of [...Object.values(world.rats),...Object.values(world.memorial??{})])r.coatBucket??=identity(r.id)%COAT_BUCKETS;
  if (envOverride) world.env = envOverride;
  world.env = decayEnv(world.env, dtDays * (CONFIG.time.realMsPerSimDay / 1000));
  world.simDay += dtDays;

  const living = aliveRats(world);
  ecologyStep(world,dtDays);
  const env = world.env;
  const mom = (r: Rat) => (r.motherId ? world.rats[r.motherId] : undefined);

  for (const r of living) {
    r.stage = stageOf(r, world.simDay);
    heatStep(r, env);
    energyStep(r, env, dtDays, mom(r));
    driveCycleHormones(r, {...env,stress:individualStress(r,env.stress)}, dtDays);
    if (r.motherId) {
      const m = mom(r);
      weanIfDue(world, r, m && m.deadAt === null ? m : undefined);
    }
  }

  for (const r of living) {
    if (r.deadAt === null && r.sex === "F" && r.stage === "adult") resumeCycleIfClear(r);
  }

  for (const r of living) {
    if (r.deadAt !== null) continue;

    if (r.socialAction && r.socialAction.until > world.simDay) { deathChecks(world,r); continue; }
    if (r.stage === "neonate" || r.stage === "juvenile") {
      pupMovement(r, rng);
      neonatalRisk(world, rng, r, mom(r), env, dtDays);
      continue;
    }

    // Adult locomotion is owned by the waypoint routine; biology continues below.
    if (r.sex === "F") {
      retrieveStep(world, r);
      cycleAndMate(world, rng, r, {...env,stress:individualStress(r,env.stress)}, dtDays, living);
    }

    deathChecks(world, r);
  }

  applyHabitatActivity(world);
  socialStep(world,dtDays,rng);
  enforceCap(world);
  separateRats(world);

  // Colony-wide states fire once on entry, not every tick.
  const now = aliveRats(world);
  const blackout = now.length > 0 && now.every((r) => r.energy < 0.02);
  if (blackout && !world.blackout) pushEvent(world, { t: world.simDay, kind: "blackout_energy", ratId: "colony" });
  world.blackout = blackout;
  if (now.length === 0 && !world.extinct) {
    world.extinct = true;
    pushEvent(world, { t: world.simDay, kind: "extinct", ratId: "colony" });
  }
  return world;
}

export function stats(world: World) {
  const living = aliveRats(world);
  let pups = 0;
  let pregnant = 0;
  let gens = 0;
  for (const r of living) {
    if (r.stage === "neonate" || r.stage === "juvenile") pups += 1;
    if (r.pregnant) pregnant += 1;
    if (r.gen > gens) gens = r.gen;
  }
  return {
    alive: living.length,
    pups,
    pregnant,
    births: world.totals.litters,
    pupsBorn: world.totals.pups,
    deaths: world.totals.deaths,
    generations: gens,
    food: world.env.food,
    warmth: world.env.warmth,
    stress: world.env.stress,
    simDay: world.simDay,
  };
}
