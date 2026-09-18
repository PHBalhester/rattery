// Public site identity. The token contract address is NOT configured here:
// the server owns it (RATTERY_CA on Vercel) and the browser learns it from
// /api/chain, so launch day is one env change + redeploy, no rebuild of copy.
export const SITE = {
  origin: "https://rattery.tech",
  x: "https://x.com/ratterytech",
  xHandle: "@ratterytech",
  github: "https://github.com/PHBalhester/rattery",
  ponsBase: "https://www.ponsfamily.com/launchpad",
  explorer: "https://robinhoodchain.blockscout.com",
} as const;

export const CONFIG = {
  token: {
    name: "RATTERY",
    symbol: "RATTERY",
    chainId: 4663,
  },
  site: SITE,

  market: {
    // Fixed ETH/USD reference used ONLY to turn a trade's ETH leg into the
    // sim's notional (marketMap reads usd). It is deliberately not a live
    // price: the same on-chain tape must always grow the same colony. Set near
    // the spot price at launch (ETH traded around $2.4k in late Aug 2026) and
    // leave it alone afterwards.
    ethUsdRef: 2400,
  },

  time: {
    // 1 sim-day = 60 real seconds
    realMsPerSimDay: 60_000,
    tickMs: 100,
    get simDaysPerTick() {
      return this.tickMs / this.realMsPerSimDay;
    },
  },

  colony: {
    seed: 20260911,
    maxAlive: 110,
    startFemales: 2,
    startMales: 2,
    burrowWidth: 1920,
    burrowHeight: 1080,
  },

  bio: {
    // Rattus norvegicus, lab-typical, compressed
    cycleDays: 4.5,
    estrusHours: 20,
    postpartumEstrusStartH: 6,
    postpartumEstrusEndH: 15,
    postpartumFertileP: 0.55,
    gestationMin: 21,
    gestationMax: 23,
    litterMin: 4,
    litterMax: 14,
    birthWeightG: 5.5,
    eyesOpenDay: 14,
    weanDay: 21,
    femaleMatureDay: 50,
    maleMatureDay: 55,
    lifespanDays: 400,
    // BALANCE KNOB (not a mechanic). At 0.08 a dam's drain is
    // 0.08 * litterSize * (2 - maternalInvest); a litter of 9 costs ~0.72
    // energy/day, far above any possible forage gain, so every dam starved
    // within a day of birth and orphaned her whole litter (mass
    // neonatal_abandon). 0.025 lets a well-fed dam support ~8 pups while big
    // litters in a poor market still exhaust her (fewer, sharper survivors).
    lactationCostPerPup: 0.025, // energy / sim-day
    basalCostAdult: 0.12,
    basalCostPup: 0.04,
    // BALANCE KNOB (not a mechanic). Was a hardcoded 0.22 inside tick.ts. At
    // 0.22 the energy economy is net-negative unless food stays > ~0.68 for
    // adults and ~0.87 for a whole 21-23d pregnancy, so the colony died at
    // generation 0 in every market. 0.40 puts adult break-even food at ~0.44
    // and pregnant break-even at ~0.59. Retune against real Pons volume.
    forageGain: 0.4,
    // Fraction of adult forage an eyes-open pup (day 14 to weaning) gets from
    // nibbling solid food. Real pups start on solids around day 15 to 17.
    juvenileForage: 0.35,
  },
} as const;

export function ponsUrl(ca: string) {
  return ca ? `${SITE.ponsBase}/${ca}` : SITE.ponsBase;
}

export function explorerToken(ca: string) {
  return ca ? `${SITE.explorer}/token/${ca}` : SITE.explorer;
}
