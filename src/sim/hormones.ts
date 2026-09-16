import type { Hormones, CyclePhase, Rat, WorldEnv } from "../types";

export const ZERO_H: Hormones = {
  gnrh: 0.1,
  lh: 0.1,
  fsh: 0.1,
  e2: 0.15,
  p4: 0.2,
  prl: 0.1,
  ot: 0.05,
  cort: 0.2,
  da: 0.1,
};

export function clamp01(x: number) {
  return Math.max(0, Math.min(1, x));
}

export function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

// The relaxation rates below were tuned as "fraction per 100ms tick" (1/600
// sim-day). approach() keeps that exact behaviour at the reference tick while
// making the endocrine system independent of CONFIG.time.tickMs.
const DT_REF = 100 / 60_000;
let memoDt = -1;
const memo = new Map<number, number>();

function alpha(rate: number, dt: number) {
  if (dt === DT_REF) return rate;
  if (dt !== memoDt) {
    memo.clear();
    memoDt = dt;
  }
  let a = memo.get(rate);
  if (a === undefined) {
    a = 1 - Math.pow(1 - rate, dt / DT_REF);
    memo.set(rate, a);
  }
  return a;
}

/** Move a toward b at `rate` per reference tick, scaled to dt, clamped 0..1. */
export function approach(a: number, b: number, rate: number, dt: number) {
  return clamp01(lerp(a, b, alpha(rate, dt)));
}

export function phaseFromCycleT(t: number, cycleDays: number): CyclePhase {
  const x = ((t % cycleDays) + cycleDays) % cycleDays;
  // 4.5d cycle: diestrus 2.0 / proestrus 0.7 / estrus 0.8 / metestrus 1.0
  if (x < 2.0) return "diestrus";
  if (x < 2.7) return "proestrus";
  if (x < 3.5) return "estrus";
  return "metestrus";
}

/**
 * Stress and reward tone for everyone, plus the estrous / lactational switch
 * for adult females. This is the only place corticosterone tracks the market
 * (it used to be integrated a second time in tick.ts).
 */
export function driveCycleHormones(r: Rat, env: WorldEnv, dt: number) {
  const h = r.hormones;
  const stressed = env.stress * r.genome.stressGain;

  if (r.stage !== "adult" || r.sex !== "F") {
    h.cort = approach(h.cort, stressed, 0.15, dt);
    h.da = approach(h.da, env.dopaminePulse, 0.35, dt);
    return;
  }

  h.cort = approach(h.cort, stressed, 0.2, dt);
  h.da = approach(h.da, env.dopaminePulse * 0.8, 0.3, dt);

  // A pregnant dam's endocrine profile is driven by pregnancyHormones().
  if (r.pregnant) return;

  if (r.nursing.length) {
    r.cycle = "anestrus_lactational";
    h.prl = approach(h.prl, 0.85 + r.nursing.length * 0.02, 0.2, dt);
    h.ot = approach(h.ot, 0.45 + env.warmth * 0.2, 0.2, dt);
    h.e2 = approach(h.e2, 0.15, 0.1, dt);
    h.p4 = approach(h.p4, 0.55, 0.1, dt);
    h.gnrh = approach(h.gnrh, 0.05 + (1 - stressed) * 0.05, 0.1, dt);
    return;
  }

  switch (r.cycle) {
    case "diestrus":
      h.e2 = approach(h.e2, 0.2, 0.2, dt);
      h.p4 = approach(h.p4, 0.45, 0.2, dt);
      h.lh = approach(h.lh, 0.15, 0.2, dt);
      break;
    case "proestrus":
      h.e2 = approach(h.e2, 0.9 * (1 - h.cort * 0.5), 0.35, dt);
      h.p4 = approach(h.p4, 0.2, 0.2, dt);
      h.gnrh = approach(h.gnrh, 0.8 * (1 - h.cort * 0.7), 0.35, dt);
      h.lh = approach(h.lh, 0.7, 0.25, dt);
      break;
    case "estrus":
      h.e2 = approach(h.e2, 0.7, 0.2, dt);
      h.lh = approach(h.lh, 0.95 * (1 - h.cort * 0.6), 0.4, dt);
      h.ot = approach(h.ot, 0.3 + h.da * 0.2, 0.2, dt);
      break;
    case "metestrus":
      h.e2 = approach(h.e2, 0.2, 0.25, dt);
      h.p4 = approach(h.p4, 0.5, 0.25, dt);
      h.lh = approach(h.lh, 0.15, 0.25, dt);
      break;
    case "anestrus_lactational":
      // resume-to-diestrus handled in colony.resumeCycleIfClear
      break;
  }
}

export function pregnancyHormones(h: Hormones, day: number, total: number, cort: number, dt: number) {
  const p = total > 0 ? day / total : 0;
  h.p4 = approach(h.p4, 0.4 + p * 0.5, 0.2, dt);
  h.e2 = approach(h.e2, 0.2 + p * 0.55, 0.15, dt);
  h.prl = approach(h.prl, 0.25 + p * 0.2, 0.1, dt);
  h.ot = approach(h.ot, p > 0.95 ? 0.9 : 0.15, 0.4, dt);
  h.cort = clamp01(Math.max(h.cort, cort));
}
