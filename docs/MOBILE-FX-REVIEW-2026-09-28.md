# Mobile dock and Season effects review — 2026-09-28

Sources: ui-clarity b6ff35c (includes 3941412); season-nests-art 2feeeb9.
No main merge or deployment performed during this review.

## Hardware and limits
Windows Edge headless, ANGLE Direct3D11, NVIDIA GeForce RTX 4060 Ti. Hardware renderer asserted; no software renderer. Local development demo with four simulated colony residents, three maximum-tier nests and six cosmetic mascots. These are not production-load or low-end-device measurements.
No physical iPhone, Android phone or ordinary laptop tested. Touch viewports on desktop do not validate Safari safe-area behavior, browser chrome, thermals or mobile GPU performance. Native safe-area validation remains pending.

## Results
Season production build and season-nests-browser passed (placement, tiers, winner, reduced motion, reset). GPU benchmark passed, including tier reversal and mascot LOD.

| Scenario | Mean RAF FPS | p95 frame ms |
|---|---:|---:|
| Overview 1440 x 1000 | 60.0 | 16.9 |
| Close-up | 59.8 | 16.9 |
| Direct attack | 58.1 | 16.8 |
| Shield + blocked attack | 60.0 | 16.8 |
| Feed | 60.0 | 16.8 |
| Winner | 60.0 | 16.8 |
| 390 x 844 viewport on desktop GPU | 60.0 | 16.9 |

Attack changed preview score 4000 -> 3960; blocked attack preserved 3960; feed changed it to 3980. No page errors detected. Static batching reported 15/17/16 draws versus 79/90/83 source draws; mascots used LOD 1 or 2. Whole-frame telemetry includes multiple rendering passes and is not equivalent to raw scene drawable counts.

UI panels passed at 1440 x 900, 1024 x 768, 390 x 844 and 360 x 740, English and Chinese. Additional touch-layout checks at 360 x 740, 390 x 844, 393 x 852 and 430 x 932 passed: five tabs, sheet close, no horizontal overflow, sheets above dock, ticker above dock. Season actions remain grouped beneath banner.

Six desktop camera flights: first 55.9 FPS, subsequent approximately 60 FPS; planned durations 1.146–1.7 seconds. Cancellation, reduced motion, keyboard guards and mobile cinema geometry passed. The test still used obsolete Show info on mobile; corrected it to click the Colony dock tab in both branches.

## Evidence
Local ignored test-results/browser contains season-gpu-results.json, rat-tour-gpu-results.json, mobile-dock-results.json, screenshots and WebM recordings. GPU script now measures and records direct attack, shield block and feed explicitly. Physical-device safe-area and low-end performance remain required before describing the experience as mobile-validated.