# Calibration endurance checks — 2026-09-17

Run `npx tsx scripts/calibration-soak-test.ts`. Three deterministic seeded cases each cover 60 simulated days (180 cumulative), at the native 100 ms tick / 60 seconds per simulation-day ratio. All execution is local; no wallet calls or blockchain writes occur. Trade cases inject one synthetic USD 1,200 buy or sell each simulated day. This is not arbitrary-volume load coverage or a statistical population study.

| Scenario | Alive at day 60 | Births | Deaths | Peak | Food | Environmental stress |
|---|---:|---:|---:|---:|---:|---:|
| No trades | 5 | 9 | 8 | 13 | 0.38 | 0.60 |
| Daily giant buy | 7 | 3 | 0 | 7 | 0.995 | 0.579 |
| Daily giant sell | 4 | 0 | 0 | 4 | 0.38 | 0.643 |

The first death in the quiet case was detected at the day-33 sampling boundary; sampling is daily, so this is not the exact death timestamp. Reproduction differs through nonlinear timing, needs and interactions; these counts do not demonstrate that more purchases always cause more births.

Assertions passed: finite positions and bounded resources/energy/hydration/isolation, population never above the configured cap, and exact snapshot-resume equivalence when replay receives identical trades. A separate ecology fixture with 80 residents held in one zone versus distributed zones gave mean individual stress 0.983 versus 0.402. This checks ecological pressure, not 80-rat render performance or navigation.

Public read-only check observed the third run around day 130: 35 alive, 32 births, one death, non-halted market and fresh snapshots. Two public browser sessions and offline recovery passed with the enlarged population, with no JavaScript page errors. Database counts confirmed 36 retained identities, one retained death and no missing mother/father references. No reset or production mutation was performed by these tests.

## Follow-up calibration (resolved by engine v5)

The existing environmental stress recurrence converges to 0.60 without trades: decayEnv applies stress*(1-.4*d)+.24*d. This is distinct from individual acute/chronic stress, but can make quiet conditions persistently tense. Revisit whether this should depend on actual scarcity or relax toward a calmer baseline, then version and test any change before migrating the running colony. These tests preserve that existing rule; passing assertions does not endorse all balance choices.

Full historical memorial pagination, offsite scheduled backups/full restoration drill, device coverage, long-duration render profiling and public abuse/load testing remain separate acceptance work.

The resting-stress follow-up was subsequently implemented and retested. See [engine v5 transition and results](../deploy/STRESS-V5.md). The table above preserves the v4 baseline rather than silently replacing historical results.
