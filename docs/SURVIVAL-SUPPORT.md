# Purchase support and sell calibration — 2026-09-18

All figures below are printed by the tests named at the end. Regenerate them
before editing this file by hand; the numbers here are copied from a run, not
estimated.

## The contract

Both sides of the tape now draw on one continuous intensity curve,
`min(0.35, USD / 1000)`, so a buy and a sell of the same size take the same
amount from the shared anti-burst budget. The asymmetry lives entirely in the
per-side coefficients in `CONFIG.survival`:

| Signal | food / water | warmth |
| --- | --- | --- |
| buy | +0.5 per unit of intensity | +0.25, capped at 0.76 |
| sell | -0.15 per unit of intensity | -0.10, floored at 0.05 |
| new holder | +0.02 food, flat | — |

Per transaction, before saturation and budget limits, in resource points out
of 100:

| Trade | food / water |
| --- | --- |
| US$25 buy | +1.25 |
| US$100 buy | +5.0 |
| US$500+ buy | +17.5 (intensity saturates at 0.35) |
| US$100 sell | -1.5 |
| US$500+ sell | -5.25 |

That is a 3.3:1 buy-to-sell ratio. It is deliberate. A memecoin order book is
roughly two-sided over time, so a symmetric mapping would make a live tape
quietly net-negative and the colony would die of arithmetic rather than of
market abandonment. Measured directly: a US$100 buy adds 0.0500 food, a US$100
sell removes 0.0150.

Quiet depletion costs 0.25 food/water points and 0.15 warmth points per
simulated day. Lactation costs 0.012 energy per pup per simulated day, so a
well-fed dam can support an ordinary litter without a structurally negative
energy balance.

## What sells do now

Before this change sells only raised stress; they did not touch food or warmth,
despite `PUBLIC_MAP` promising "sell -> food down, warmth down" on the site
footer. The code now honours that line. Sells push resources below the silence
floor of 0.12, down to a hard floor of 0.05, which is what makes "big sell ->
nest collapse risk" a real mechanic rather than copy. Resources never reach
zero from any path.

Warmth from buys is capped at 0.76. That sits under both heat-stress thresholds
in the engine (0.78 in `colonyMetrics`, 0.80 in `restingStress`) so support can
never overheat the habitat, while still being high enough that a big buy reads
as a genuine insulation spike. It was 0.72 before, which made the "nest
insulation spike" line unreachable.

## Measured results

Resource scenarios, 24 real hours (1440 simulated days) of regular buys:

| Cadence | food | water | warmth |
| --- | --- | --- | --- |
| US$25 every 3 min | 0.993 | 0.993 | 0.756 |
| US$100 every 10 min | 0.975 | 0.975 | 0.745 |
| US$500 every 30 min | 0.925 | 0.925 | 0.715 |

Balanced tape, equal buy and sell dollar volume over the same 24 hours: food
and water both end at 0.960. Sell-heavy tape, US$500 sells every 2 minutes:
food, water and warmth all reach 0.050, the floor, and stop there.

Seeded biology, 120 simulated days with US$100 every 10 minutes, at the coarse
test step: seeds 7, 41 and 20260911 ended with 11, 43 and 39 living rats, zero
deaths, no extinction.

At the exact step the live worker uses (`CONFIG.time.simDaysPerTick`, 100 ms),
30 simulated days under the same support ended with 12 living rats, zero
deaths, food 0.755. A one-off manual run of the same scenario extended to 120
days ended with 38 living rats and zero deaths; only the 30-day version is in
CI, because the 120-day version costs about 80 seconds.

## Limits, stated plainly

Without an activated permanent core, a silent tape still ends the colony. With no buys at all, at production
resolution, seed 7 reaches zero living rats within 120 simulated days. Support
is what prevents extinction in that legacy mode. Production v24 adds a separately activated permanent six-resident core (see OPERATIONS.md). The purchase support described here does not make a colony immortal, revive dead
rats, or resets a round.

The buy/sell ratio means a balanced market trends strongly toward full
resources. That is the point, but it also damps the market-driven selection
that the project is about: with buys worth 3.3x sells and lactation cost
halved, ordinary volatility no longer culls litters the way it did. If the
spectacle matters more than stability later, the knobs to turn back are
`buyFood`, `sellFood` and `lactationCostPerPup`, in that order.

These accelerated scenarios are not guarantees for every population or trade
sequence. The 120-day biology figures come from a coarser step than production
uses, which draws fewer per-tick RNG samples; the production-resolution test
exists to catch a divergence, but it covers 30 days, not 120.

The engine configuration fingerprint changes with this commit. The previous
production state is preserved in the engine transition audit. No live
transactions were generated for any test, and no round was started or reset.

## Reproducing

```
npm run test:survival        # scripts/survival-support-test.ts
npm run test:survival:prod   # scripts/survival-production-resolution-test.ts
npm run test:trades:approved # 36/36 approved trade-rule assertions
npm run typecheck && npm run typecheck:server && npm run build
```
