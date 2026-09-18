# Courtyard follow-up validation — 2026-09-17

The approved courtyard remains deployed to staging as engine v6. This follow-up did not activate real payments or replace the colony.

## Passed

- 180 simulated days: three 60-day scenarios (quiet, giant buys, giant sells). Resource bounds, finite positions, population cap and snapshot replay passed. Final populations were 2 / 17 / 2; first deaths in quiet/sells occurred at days 38 / 35. These are specific seeded scenarios, not predictions.
- Packed/distributed ecology fixture: mean stress 98.3% / 47.4%. Local density continues to matter independently of global population.
- Activity adversarial checks: exclusive wheel use, social interruption, panic cancellation, no remote toy animation.
- Enrichment and separation: bounded rewards, reproducibility, walkable correction, preserved social contacts and RNG.
- Rat rendering math: anatomy at nine zoom distances, finite transforms, reduced motion and heading.
- 36 approved trade-rule checks; generic-token care permissions, costs/cooldowns, replay and ownership; isolated burn validator with 15 invalid receipt cases and deduplication.
- Default demonstration UI in Chromium, Firefox and WebKit: Blender model loaded, wallet dialog, language switch, panel toggle, reload and 390/844/320-pixel width checks completed. No page errors. Requests originated only from staging.rattery.tech in these samples.

## Not approved / limitations

- The default demonstration failed the existing 180-frame/15-second rendering budget in all three headless browsers (52/32/30 frames respectively). Functional UI success is not a performance pass.
- Initial full shared-colony runs timed out when clicking Wallet in Chromium and Firefox while local CPU tests were running. An isolated renderer diagnostic follows; do not infer real-device performance from software-rendered automation.
- The full 120-day deterministic-history suite was interrupted to isolate CPU load; its chained replay suite therefore did not run. The 180-day soak's checkpoint replay passed, but is not equivalent to that complete suite.
- Physical Android/iOS/Safari, heat/battery, mobile network and a 30–60-minute physical-device session remain pending.

Raw soak and browser results are in ignored test-results files. WebKit and its operating-system dependencies were installed for local validation; these are not application dependencies or public deployment changes.

## Isolated shared-colony rendering diagnostic

Chromium reported ANGLE/Vulkan SwiftShader (software rendering), at 800x600. With CPU simulation tests stopped, Wallet interaction still exceeded 30 seconds. This reproduces the headless performance limitation without concurrent simulation load; hardware-accelerated and physical-device performance remain unverified.

A focused restart test passed with 90 rats and active den reservations: JSON checkpoint restoration reproduced the exact world, RNG and routes after 150 subsequent ticks.
