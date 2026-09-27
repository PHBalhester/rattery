# Season nests: batching and desktop GPU validation

Base: origin/season-nests-art, Opus art pass 137fb32. Development preview only; no main merge or deployment.

## Changes
- Once construction settles, merge static meshes per material, shadow settings, render order and layer. Preserve vertex colours, normals, UVs and nested transforms. Flags, signs, mascots, effects and the lantern light remain independent.
- Restore original meshes before a tier transition, including reduced-motion jumps. Dispose obsolete merged geometry without disposing shared materials.
- Fully built static draws: NVIDIA 79 -> 15, Apple 90 -> 17, Amazon 83 -> 16. Total 252 -> 48 (81% fewer static mesh draws). This is not the total scene or multipass draw count.
- Cosmetic mascots never use LOD 0: minimum LOD 1 at high/balanced, LOD 2 at economy/minimal. Distance can reduce detail further. Default resident behaviour is unchanged.
- Preview telemetry now totals the complete frame rather than reporting only the final postprocessing screen quad.

## Desktop measurements
Windows, Edge headless with hardware ANGLE / Direct3D11, NVIDIA GeForce RTX 4060 Ti, driver 32.0.15.9174. Browser reports the NVIDIA renderer, not SwiftShader. Viewport 1440 x 1000, device scale 1, all nests at 4000 demo points. Recording performed separately after measurement. Short samples; not a thermal/endurance benchmark.

| Scenario | Duration | Mean FPS | 95th percentile frame time |
| --- | --- | --- | --- |
| Overview | 12.02 s | 60.0 | 16.9 ms |
| Close-up | 12.02 s | 59.9 | 16.9 ms |
| Winner reveal | 8.02 s | 60.0 | 16.8 ms |
| 390 x 844 viewport on same desktop GPU | 8.02 s | 60.0 | 17.0 ms |

Adaptive quality was balanced during overview/close-up and high by the end of the reveal. These are adaptive results, not fixed-high benchmarks. Mobile viewport is a layout check, NOT a phone benchmark. No ordinary laptop or physical phone was available.

Results: test-results/browser/season-gpu-results.json.
Recording: test-results/browser/season-nests-rtx4060ti.webm.
Screenshots: season-gpu-overview.png, season-gpu-closeup.png, season-gpu-mobile-layout.png in the same directory.
Artifacts are ignored by Git. Run scripts/season-nests-gpu.cjs using Windows Node and an installed Edge, with Playwright FFmpeg installed for recording. The script rejects software GPU renderers.

## Validation and remaining observations
- Build, all three adaptive rendering suites, static batch regression, atmosphere browser lifecycle and Season browser flow pass.
- Batch regression covers transformed vertex bounds, vertex colours, hidden geometry, active lights, restoration, idempotence and material ownership.
- GPU script also checks reversible tiers under reduced motion and mascot LOD floors.
- src/sim and src/config.ts match origin/ui-clarity. Production bundle excludes the Season preview and static batching module.
- NVIDIA flag is partly clipped by the top edge in the current close-up camera; framing still needs an art adjustment.
- Physical phone and ordinary laptop FPS, sustained thermal performance, and real paid-care production smoke test remain separate pending checks.
- No licensed logo files were introduced.


## Follow-up after resident gesture merge
Rechecked after integrating ui-clarity bfe49af and the reduced-motion fixes: overview 59.3 FPS (p95 16.9 ms), close-up 59.7 FPS (p95 17.0 ms), winner effects 56.4 FPS (p95 33.3 ms). Same RTX 4060 Ti and sample lengths as above. Mobile viewport on desktop measured 59.1 FPS; still not a physical-phone result. Build, static-batch regression, reversible tiers and mascot LOD checks passed. Scene remains development-only; main was not merged.
