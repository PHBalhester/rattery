export type Sex = "F" | "M";

export type LifeStage =
  | "fetus"
  | "neonate" // d0-13, eyes closed
  | "juvenile" // d14-wean
  | "weanling"
  | "adult"
  | "dead";

export type CyclePhase =
  | "diestrus"
  | "proestrus"
  | "estrus"
  | "metestrus"
  | "anestrus_lactational";

export type DeathCause =
  | "age"
  | "starvation"
  | "cold"
  | "neonatal_abandon"
  | "neonatal_cannibal"
  | "stillbirth"
  | "crowding"
  | "none";

export interface Genome {
  stressGain: number; // 0.6..1.6
  maternalInvest: number; // 0.5..1.5
  litterBias: number; // -2..+2 pups
  heatNeed: number; // 0.7..1.3
  fertility: number; // 0.7..1.3
}

export interface Hormones {
  gnrh: number;
  lh: number;
  fsh: number;
  e2: number; // estradiol
  p4: number; // progesterone
  prl: number; // prolactin
  ot: number; // oxytocin
  cort: number; // corticosterone
  da: number; // dopamine (VTA/NAc proxy)
}

export interface Pregnancy {
  sireId: string;
  // Copied at conception: the sire may die (and be pruned) before delivery.
  sireGenome: Genome;
  conceivedAt: number; // simDay
  dueAt: number;
  plannedLitter: number;
  // Market state at conception drives the epigenetic tags on the litter.
  conceivedStressed: boolean;
  conceivedFlush: boolean;
}

export interface Rat {
  coatBucket?:number;
  /** Public display metadata only; never authorizes care or payments. */
  minted?: boolean;
  caregiver?:boolean;
  residenceDays?:number;
  petAt?:number;
  careStimulus?:{kind:"prosocial"|"aggression";until:number};
  id: string;
  name: string;
  sex: Sex;
  bornAt: number; // simDay; negative for founders
  deadAt: number | null;
  deathCause: DeathCause;
  gen: number;
  motherId: string | null;
  fatherId: string | null;
  genome: Genome;
  hormones: Hormones;
  wellbeing?: {isolationDays?:number;isolationDistress?:number;acute:number;chronic:number;hydration:number;lastWater:number;cause:string;support:number;crowding:number;zone:number};
  injury?: number; // 0..1 injury burden, health = 1 - injury
  maternalNest?: {x:number;y:number;r:number;zone:number};
  exploration?: {waterZone?:number;den?:number;denSlot?:number;denUntil?:number;denCooldown?:number;route:number;waypoint:number;restUntil:number;playingUntil?:number;target?:string;path?:{x:number;y:number}[]};
  socialAction?: { alignment?:number; encounter?: {started:number;heading:number;x:number;y:number;scale:number;attempted?:boolean}; path?: {x:number;y:number}[]; arrived?: boolean;kind: "courtship" | "mating" | "fight" | "groom"; partner: string; until: number};
  energy: number; // 0..1
  heat: number; // 0..1 felt warmth
  x: number;
  y: number;
  vx: number;
  vy: number;
  stage: LifeStage;
  cycle: CyclePhase;
  cycleT: number; // days into current cycle
  pregnant: Pregnancy | null;
  nursing: string[]; // pup ids
  lastBirthAt: number | null;
  postpartumWindow: boolean;
  inNest: boolean;
  retrieving: string | null;
  offspring: number; // live pups delivered (dams only); keeps lineage nodes alive
}

export type TradeSide = "buy" | "sell";

export interface Trade {
  id: string;
  ts: number; // unix ms (block timestamp for on-chain trades)
  side: TradeSide;
  eth: number; // quote leg in ETH, straight from the chain
  // Browser replay uses eth * CONFIG.market.ethUsdRef. Shared server trades
  // use an immutable historical valuation recorded in the persistent ledger.
  usd: number;
  tokens: number;
  trader: string;
  isNewHolder: boolean;
  venue: "demo" | "curve" | "pool";
  block?: number;
  logIndex?: number;
  // Seen while warming up the feed: shown on the tape, never fed to the nest.
  backlog?: boolean;
}

export interface WorldEnv {
  tradeBudget?:number;
  tradeBudgetAt?:number;
  nextTradeReactionAt?:number;
  groupSignal?:TradeSide;
  socialSignals?: ("buy" | "sell")[];
  food: number; // 0..1
  warmth: number; // 0..1
  water: number; // 0..1 available hydration
  stress: number; // 0..1
  dopaminePulse: number;
  lastTradeAt: number; // unix ms
  buyPressure: number; // EMA
  sellPressure: number;
  holdersApprox: number;
  // Transient locomotion drives (Feature 1). Buys raise forage (the colony
  // spreads out to feed); sells and crashes raise panic (bolt to the nest and
  // huddle). Kinematic only: they bias movement, never energy or hormones.
  // Both decay fast in decayEnv, so a quiet tape leaves normal wandering.
  forage: number;
  panic: number;
}

export interface WorldEvent {
  t: number; // simDay
  kind:
    | "birth"
    | "stillbirth"
    | "wean"
    | "death"
    | "conceive"
    | "estrus"
    | "reject_nest"
    | "retrieve"
    | "cannibal"
    | "blackout_energy"
    | "extinct";
  ratId: string;
  extra?: string;
}

export type MemorialRecord=Pick<Rat,"coatBucket"|"id"|"name"|"sex"|"bornAt"|"deadAt"|"deathCause"|"gen"|"motherId"|"fatherId"|"offspring"|"caregiver"|"residenceDays">;

export interface World {
  careProtection?:{until:number;active:boolean};
  legendaryBoost?:{untilSimDay:number;claimedBy?:string};
  nextCrowdingDeathAt?: number;
  memorial?: Record<string,MemorialRecord>;
  care?: import("./sim/care").CareState;
  demoToken?:{supply:number;balances:Record<string,number>};
  habitatMode?: "basic" | "enriched";
  ecology?: {nextSample:number;history:{day:number;population:number;stress:number;births:number;deaths:number}[];memories:Record<string,{care:number;conflicts:number;shared:number;last:number;lastKind:string}>;events:{day:number;kind:string;a:string;b:string}[]};
  social?: { affinities: Record<string, number>; cooldown: number; nextAmbient: number };
  simDay: number;
  realStartedAt: number;
  // Living rats plus dead dams that left offspring (the lineage). Other dead
  // rats are pruned on death so per-tick scans stay proportional to the nest.
  rats: Record<string, Rat>;
  env: WorldEnv;
  events: WorldEvent[]; // newest first, capped; for display
  nextId: number;
  seed: number;
  // mulberry32 state. Lives in the World so a snapshot is the whole truth.
  rngState: number;
  totals: { litters: number; pups: number; deaths: number };
  lastBirth: { ratId: string; t: number } | null;
  blackout: boolean;
  extinct: boolean;
}
