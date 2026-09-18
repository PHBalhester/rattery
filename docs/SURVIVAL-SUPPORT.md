# Purchase support calibration — 2026-09-18

Purchases now replenish survival resources more strongly. Their bounded intensity is min(0.35, USD / 1000); each accepted unit restores 0.4 food, 0.4 water and 0.2 warmth. The shared anti-burst budget remains in place. Repeated small transactions cannot bypass it. Purchases do not force animations below the existing US$50 threshold.

Examples before saturation/budget limits: US$25 restores 1 food and 1 water point; US$100 restores 4 points each; US$500 or above restores up to 14 points each. Benefits saturate at full resources and do not stack into infinite reserves. Purchase warmth is capped at 72% so support does not itself overheat the habitat.

Quiet depletion now costs 0.25 food/water points and 0.15 warmth points per simulated day, half the previous depletion. Lactation costs 0.012 energy per pup per simulated day instead of 0.025, allowing well-fed mothers to support ordinary litters without a structurally negative energy balance.

Validation: 24-hour resource scenarios with US$25/3min, US$100/10min and US$500/30min retained adequate resources. Three seeded 120-day biological scenarios with US$100 purchases every 10 minutes ended with 12, 41 and 16 living rats, zero deaths and no extinction. These accelerated survival scenarios are not guarantees for every population or trade sequence. All 36 approved trade-rule assertions passed. Build and server type checks passed.

Natural aging, crowding limits and severe deprivation still apply. These changes strengthen support rather than granting immortality, reviving dead rats or silently resetting the round. No live transactions were generated for tests. The engine configuration fingerprint changes and the previous production state is preserved in the engine transition audit.
