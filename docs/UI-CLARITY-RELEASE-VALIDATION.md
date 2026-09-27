# UI clarity release validation — 2026-09-26

Source: ui-clarity, based on Opus bfe49af. Season nest code is not included in this release.

Validated:
- Production Vercel build using the linked project's production configuration.
- Panel browser flow at 1440x900, 1024x768, 390x844 and 360x740, English and Chinese.
- PaidCare isolated browser test at desktop and mobile widths: selection, reserve, exact fake burn, duplicate prevention, recovery and ownership restrictions. No real transaction.
- All three adaptive rendering regression suites, resident reduced-motion regression, API typecheck and ESM checks, production exclusion of the local payment lab.
- Publication and secret scans. Removed a local checkout path from an older integration report.
- Simulation and config remain identical to main.

Reduced-motion follow-up:
- Active resident gestures reset immediately when reduced motion is requested.
- An in-progress number animation snaps to its final value when the preference changes.
- Browser check changes that preference during a counter animation.

GPU: Windows Edge headless, hardware ANGLE Direct3D11 on NVIDIA GeForce RTX 4060 Ti. 1440x900, device scale 1. Three 10-second samples: overview 60.0 FPS / p95 17.0 ms; following a resident 60.0 FPS / p95 16.8 ms; reduced motion 60.0 FPS / p95 16.8 ms. Adaptive quality remained high. Recording is separate from the benchmark. These short desktop samples do not establish thermal endurance or physical phone/laptop performance. Production population and workload may differ from the local demo.

Artifacts are ignored by Git: test-results/browser/ui-gpu-results.json, ui-resident-gestures-rtx4060ti.webm and panel screenshots.

Real-wallet Pet remains pending at the user's explicit request. Ordinary laptop and physical phone measurements remain pending. The previously documented exploration-test failure on the main baseline is not modified by this visual release.

Tutorial and Whitepaper remain disabled as Coming soon. No Season 1 payment or gameplay preview is publicly enabled.
Rollback reference: deployment dpl_2CKGJhyF5Ah5fCyG2dJBiVcqqFzc.
