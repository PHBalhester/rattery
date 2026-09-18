# Resource and isolation calibration (2026-09-17)

These are simulation design parameters and expressive animation cues, not a diagnosis or validated animal-behavior measurement.

Initial reserves: food 0.68, water 0.72, warmth 0.60. Quiet consumption per simulated day: food 0.005, water 0.005, warmth 0.003, retaining the prior 0.12 floor. Market reaction decay, trade thresholds, token budgets and payment behavior are unchanged. Resource time now uses simulation days independently of fast mood decay.

Isolation requires sustained lack of a living companion within 150 scene units with affinity above -0.35. One simulated day is a grace period; distress then rises over five days. Contact removes four accumulated isolation days per simulated day. A short excursion has no distress signal. The colony metric averages this persisted distress, whereas cohesion still describes physical dispersion. Snapshot replay remains deterministic.

Visible cues ramp smoothly: lower head, slightly crouched body, folded ear tips, partially lowered eyelids and smaller gaze sweeps. Normal travel slows by at most 18%; panic suppresses this speed penalty. Wheel use and social actions override the cosmetic withdrawal pose. Pose is applied before foot IK; no changes follow collision resolution. Reduced-motion preferences retain their existing behavior. The individual panel exposes the signal in English and Simplified Chinese.

Tests: isolation-calibration-test covers grace, sustained separation, reunion recovery, snapshot determinism, resource timestep independence and twenty full biological days without trades. Four founders survived at roughly 95–100% energy in that seeded case. ecology-test and encounter-test passed; build and worker compilation passed. isolation-visual-browser checks lowered head/eyelids and shader errors and captures the side-by-side view. These are bounded tests, not proof of indefinite survival or visual correctness on every device.

The two extinct runs are retained in their original databases. The calibrated third run starts fresh with explicit engine version shared-colony-v4; no dead rats were resurrected. The first run also has an operator-authorized private local archive, excluded from Git. Long-duration balancing and production load acceptance remain pending.
