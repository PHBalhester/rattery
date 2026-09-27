# Resident tour validation — 2026-09-27

Base: ui-clarity 93176d1. This release remains separate from Season gameplay.

## Corrections
- Mobile cinema tour had both top:92px and a bottom anchor, producing a 593px-tall container at 390x844. It now has a 42px height above the scene controls; the canvas receives touches in its central area.
- Previous/Next now preserve cinema mode instead of invoking the general focus action that reopened the information panel.
- Scene control buttons cancel an active flight. Enabling reduced motion mid-flight immediately settles at the selected rat.
- The development-only flight diagnostics support timing and cancellation checks and are absent from the production bundle.
- In season-nests-art, the tour is unmounted in preview mode so its hidden keyboard handler cannot move the resident camera.

## GPU measurement
Windows Edge headless, hardware ANGLE Direct3D11, NVIDIA GeForce RTX 4060 Ti; local demo, 1440x1000.
Six flights: first 54.0 FPS (p95 frame interval 33.4ms), next five approximately 60.0 FPS (p95 16.9ms). Configured durations in this sample: 1.14–1.70s; application bounds remain 0.85–1.70s. Recording performed separately. Short samples do not establish sustained thermal behaviour or performance on other devices.

Mobile layout checks on the desktop GPU: 390x844 and 360x740. Tour height 42px, control bar height 44px, 14px gap, no horizontal document overflow. Tour stays hidden with information open and navigation preserves cinema when information is hidden. This is not a physical phone performance measurement.

## Checks and artifacts
- Six monotonic flights; mouse drag and zoom cancellation; reduced-motion activation during a flight; keyboard selection; arrow keys ignored in text input; mobile canvas hit testing; no page errors.
- Panels EN/ZH at four widths, resident gesture regression, build, default-build payment-lab exclusion.
- src/sim and config.ts unchanged against main.
- Artifacts (ignored by Git): test-results/browser/rat-tour-gpu-results.json, rat-tour-desktop-rtx4060ti.webm, rat-tour-mobile-rtx4060ti.webm, rat-tour-mobile-390.png and rat-tour-mobile-360.png.
- Physical laptop/phone measurements and real-wallet Pet remain pending.
