// Season 1 copy. Kept out of config.ts on purpose: CONFIG feeds the engine
// fingerprint, and marketing text must never change ENGINE_VERSION.

/** Public whitepaper URL. Empty = button shows "Soon" and stays disabled. */
export const WHITEPAPER_URL = "";

/** Flip to true when rules, dates and prizes are final. Hides the draft banner. */
export const SEASON_RULES_FINAL = false;

export type SeasonStep = { icon: string; title: [string, string]; body: [string, string]; tip?: [string, string] };

// DRAFT rules. Edit freely; every string is [English, Chinese].
export const SEASON_STEPS: SeasonStep[] = [
  {
    icon: "🏆",
    title: ["The goal", "目标"],
    body: [
      "Season 1 is a competition around the colony. Help your side of the colony survive and grow. When the season ends, the prize pool is paid in tokenized stocks.",
      "第一赛季是围绕群落展开的竞赛。帮助你所在的群落存活并壮大。赛季结束时，奖池以代币化股票发放。",
    ],
    tip: ["Watching is free. Entry, extra feeding, shields and attacks burn RATTERY.", "观看免费。参赛、额外喂食、护盾和攻击均需销毁RATTERY。"],
  },
  {
    icon: "🪺",
    title: ["Pick a nest", "选择巢穴"],
    body: [
      "The colony has three nests. Each one is linked to a stock ticker. Entries and extra feeding add points and reward contribution to your active nest.",
      "群落有三个巢穴，每个巢穴对应一只股票代码。参赛和额外喂食会为当前巢穴增加积分和奖励贡献。",
    ],
    tip: ["Check how crowded each nest is before you choose.", "选择前先看看每个巢穴的拥挤程度。"],
  },
  {
    icon: "🔥",
    title: ["Enter by burning RATTERY", "销毁RATTERY参赛"],
    body: [
      "Your entry is a burn. Burned RATTERY is removed from supply forever. It is not a deposit and is never returned.",
      "参赛方式是销毁代币。被销毁的RATTERY将永久移出供应量，不是押金，也不会退还。",
    ],
    tip: ["Your wallet will always show the exact amount before you confirm.", "确认前，钱包会显示准确的销毁数量。"],
  },
  {
    icon: "🍎",
    title: ["Care and strategy", "照护与策略"],
    body: [
      "Feed your nest, shield it or attack a rival. Colony condition changes nest points every ten minutes, modified by each stock. A separate weekly stock adjustment also applies. Rat care and Season actions are distinct.",
      "喂养巢穴、开启护盾或攻击对手。群落状态每十分钟影响巢穴积分，并受对应股票走势调节；结算时另有每周股票调整。大鼠照护与赛季操作是不同的功能。",
    ],
  },
  {
    icon: "📈",
    title: ["Season end and prizes", "赛季结束与奖励"],
    body: [
      "When the season ends, standings are frozen and the winners receive tokenized stocks. Dates, scoring and prize amounts are published before the season starts.",
      "赛季结束时排名将被冻结，获胜者将获得代币化股票。日期、计分规则和奖金数额将在赛季开始前公布。",
    ],
    tip: ["Only use the official contract shown below. Copies with the same name exist.", "请只使用下方显示的官方合约，存在同名仿冒代币。"],
  },
];
