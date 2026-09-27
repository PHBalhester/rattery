# Season I tutorial review — 2026-09-27

Reviewed ui-clarity 75ce312 (including 720c835) and season-nests-art dfd21ac.
The release flag remains false. No production deployment or main merge was performed.

## Environment and limits

Windows Edge, headless, hardware ANGLE Direct3D11 on NVIDIA GeForce RTX 4060 Ti (driver 32.0.15.9174). Development servers: ui-clarity on 5176 and season-nests-art on 5173. Mobile cases use touch/mobile emulation on this desktop GPU, not a physical phone. A physical phone and ordinary notebook remain untested. Local demo colony and default nest tiers; these numbers are not a maximum-load benchmark.

## Results

All 16 steps passed in each branch at 1440x900 English, 390x844 English, and 360x640 Chinese. Cards stayed within the viewport and content had no horizontal overflow. Finish/Escape closed the guide and cinema state was restored. Tab and Shift+Tab now remain inside the modal; previously they escaped to the obscured page. Closing also restores the prior focus when it still exists.

Feed, shield, attack, and winner cues matched NVDA, AAPL, AMZN, and NVDA respectively. The renderer camera actually moved; reduced motion snapped to the next nest without continuing a flight; closing reset nest focus to overview. No page errors were observed.

Recorded full walkthroughs (requestAnimationFrame cadence; includes card transitions, screenshots, and video recording):

| Branch | Viewport | Mean FPS | p95 frame interval |
| --- | --- | ---: | ---: |
| ui-clarity | 1440x900 | 51.8 | 33.4 ms |
| ui-clarity | 390x844 | 55.5 | 33.2 ms |
| ui-clarity | 360x640 | 56.7 | 33.0 ms |
| season-nests-art | 1440x900 | 50.6 | 33.4 ms |
| season-nests-art | 390x844 | 53.6 | 33.4 ms |
| season-nests-art | 360x640 | 54.3 | 33.4 ms |

A separate 5-second desktop nest sample without video recording measured 55.6 FPS / 33.3 ms p95. This is acceptable for review but is not a locked 60 FPS result or evidence of phone performance.

## Visual follow-up

On portrait mobile the longer action cards cover much of the nest animation. Text and navigation remain usable, but a more compact scene-demo presentation should be considered before calling the mobile design final. No redesign was included in this validation fix.

## Checks and artifacts

Both production builds pass. With SEASON_TUTORIAL_LIVE=false, neither the tutorial chunk nor its title/body is emitted in production JS. Simulation, config, payment handling, and identities are unchanged.

Run scripts/season-tutorial-gpu.cjs on Windows with Edge and both dev servers running. It records both branches, asserts GPU identity is not software, checks viewport bounds, cue state, keyboard focus, reduced-motion navigation, and cinema restoration. It deliberately reads the renderer's existing __seasonStore diagnostic rather than importing a second Vite module instance. scripts/season-tutorial-browser.cjs also includes the keyboard-focus regression.

Local artifacts in test-results/browser (gitignored): season-tutorial-gpu-results.json, tutorial-camera-results.json, tutorial-{ui,nests}-{1440,390,360}.webm and per-step screenshots.
