# Adaptive rendering

Rendering quality changes are local to each visitor. They do not alter the shared simulation, random seed, trade effects, population, biological clock, limb timing or tail collisions.

The renderer starts at high quality and ignores the first five seconds. A window of at least 2.5 seconds and four frames averages frame time. Sustained frame times above 32 ms reduce quality by one step. Recovery requires 30 seconds below 22 ms; intermediate frame times reset the recovery timer. Visibility changes discard the timing window and apply another warm-up, preventing background throttling from controlling quality.

| Profile | Pixel-ratio cap | Shadow map | Fine fur visible within |
|---|---:|---:|---:|
| High | 2 | 2048 | Any distance |
| Balanced | 1.25 | 1024 | 18 normalized scene units |
| Economy | 0.9 | Off | Disabled; medium mesh or simpler |
| Minimal | 0.65 | Off | Disabled; low-detail anatomical mesh |

The existing anatomical LOD models are preserved. All visible anatomy except optional fine-fur fibres retains the same visibility rules. Economy and minimal modes disable fine fur even in close-up and cap mesh complexity. The same joint table and all anatomical parts remain present. Shadow target resizing disposes the previous GPU target; enabling/disabling shadows also updates the shadow-casting light so Three.js refreshes its shader configuration.

`?view=shared-colony&inspect-performance=1` adds a small local diagnostic readout. `.burrow-host` exposes a once-per-second `data-performance` JSON sample: FPS, quality, number of rendered rats, draw calls, triangles, geometries, textures and pixel ratio. No wallet data or telemetry is transmitted by this diagnostic.

Tests: `npm run test:render:adaptive` verifies hysteresis, pause/invalid-sample handling and exact foot-animation equality across four quality levels, three LOD distances and 120 frames per combination. It also checks that optional fur is the only changed mesh visibility.

Windows GPU benchmark and 30-minute session results are recorded separately after completion. A headless GPU-enabled browser on a desktop does not validate physical Android/iOS, touch usability, battery or heat.

## Physical iPhone feedback — 2026-09-17

The user reported smooth performance on an iPhone 15 with an unspecified current iOS version. Their screenshots qualify that result: 89 rats, 35.4 FPS/high with panels open, then 18.1 FPS/minimal in close-up with panels hidden. This does not establish sustained 30 FPS. Session length, thermal state and exact browser/iOS build were not recorded.

The close-up fallback previously restored full mesh detail and fine fur even at minimal quality. PERF-09 caps the mesh and removes optional fur in economy/minimal. Bone-pose equivalence at 30/60/120 FPS and adaptive anatomy tests pass. A new physical-device check is required; desktop emulation is not a replacement. Mobile panel density remains a usability follow-up.

GLB geometry counts per rat: full close-up 210,174 triangles (including fur); medium without fur 54,616; minimal without fur 28,862. These counts do not measure frame rate or total scene cost.
