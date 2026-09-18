# Resting stress update (engine v5)

The old recurrence silently converged to 60% even with adequate resources. The revised target is 12% plus bounded shortage contributions: up to 20 percentage points for food below 45%, 22 for water below 45%, and 16 for warmth below 38% or above 80%. Contributions grow continuously with severity; maximal target is 70%. These are simulation balance choices, not scientific measurements.

Stress approaches the target exponentially at 0.01/real second (100-second time constant). With stable adequate resources, about 95% of the difference disappears over five simulated days. Trade thresholds, budgets and direct reactions are unchanged. Individual isolation, crowding, thirst and hunger still contribute through ecology.

Deploy only after resting-stress-test, calibration-soak-test, ecology and encounter regressions plus frontend/worker builds pass. Stop the staging worker, acquire its advisory lock with an operator connection, create the operator-only engine history table (007), archive the previous world/version/tick/revision and change only engine_version and revision in the same transaction. Require the exact expected v4 fingerprint. Preserve simulation clock, rats, RNG, environment, trade cursor and financial tables. Start the v5 worker against the same database, bootstrap disabled. The public observer must retain the same runId.

The history row is an audit checkpoint, not a complete rollback backup of trade ledgers or financial state. Never replay it into a live database without a coordinated recovery plan.

## Validation results

Resting-stress tests, ecology and encounter regressions, frontend/worker builds and three 60-day scenarios passed. Final environmental stress: quiet 15.8%, daily giant buys 25.7%, daily giant sells 20.1%. The buy case reached warmth 99.7%, so it correctly retained a thermal contribution: it is not a healthy-temperature control. Same-seed final living populations were 5/30/2; births 11/26/4 and deaths 10/0/6. These are individual fixtures, not statistical guarantees. Packed/distributed stress remained approximately 98.3%/40.2%.

The v4-to-v5 transition recorded the previous world and confirmed exact equality of world JSON, simulation tick and clock across the version change. Only engine_version and revision changed. The third run/database was retained; no new colony was created.

Post-deployment verification passed: same third run, engine v5, two public observers on an identical revision with 58 living rats, offline recovery, and no page errors. The live environmental stress was observed at 17.4% after a 60.2% transition checkpoint. Biology lag recovered to milliseconds and the market timestamp was within eight seconds at the sampled check. These are point-in-time observations, not a service-level guarantee.
