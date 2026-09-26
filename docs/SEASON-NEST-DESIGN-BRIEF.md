# Season nest visual direction

Reference placement: user annotation, three separate areas on the existing habitat. NVIDIA nest A occupies the upper left, Apple nest B the lower left, Amazon nest C the upper right. Camera faces the habitat from the opposite side to the former default overview so the existing shared dens remain at the top, as in the reference.

## Current preview

Run npm run dev and open http://localhost:5173/?season-preview=1.
The preview is development-only and excluded from production JavaScript. The production Tutorial and Whitepaper remain disabled with Coming soon labels. No payment, settlement or authoritative score feed is connected.

The layer adds three nests, flags with company names and tickers, point labels and six cosmetic mascot rats using the existing articulated models with isolated green, silver and orange coats. These are not six new residents. No identities, ownership, birth dates, permanent-core membership or simulation state are changed.

Visual tiers are provisional art direction: bedding at 0, shelter at 250, haven at 1,000, and a decorated lodge at 3,000 demo points. This creates no gameplay cap or reward multiplier. Score loss can reduce a nest's visual tier; actual display integration will follow the authoritative season ledger.

Effects: woven bedding, stage-by-stage shelter construction, wind-deformed cloth with pinned flagpole edge, existing articulated mascot movement, food delivery particles, a translucent shield dome, a cosmetic snake pass, a rotating winner crown and bounded fireworks. The reveal uses an explicit winner input; it does not infer or execute settlement. Reduced motion preserves a static crown and suppresses animated fireworks. Lower quality levels reduce particle counts and optional movement.

## Brief for Opus

Improve the scene design on top of feature/season-nests, preserving all boundaries above. Focus on hand-built miniature nests, visible entrances and mascots, readable company flags, and a warm habitat palette. Keep A upper left, B lower left and C upper right in the reference view. The three nests should feel related while gaining distinct green, silver and orange accents.

Refine four reversible visual growth tiers without making them economic rules. Consider additional small bedding details, food-carrying poses and a short coordinated winner gesture. Keep a strict particle budget, reduced-motion support and AdaptiveQuality behavior. Never write to src/sim, CONFIG or production wallet flows for an art change.

Useful files: src/render/SeasonNests.ts, src/render/SeasonNestPreview.tsx, src/season/visualState.ts, src/render/Burrow3D.tsx and the optional visualTint argument in src/render/BlenderRat.ts. Keep the existing no-tint rendering path unchanged.

Please return patches, screenshots at desktop and mobile sizes, and the build/test results. No direct chat integration with Opus was used; this brief is for manual sharing.
## Validation

Production build and all three adaptive rendering regression suites pass. The development preview passes placement, six-mascot, tier, explicit winner, particle-budget, reduced-motion, mobile overflow and reset checks. Simulation and config files are unchanged. The preview controls and scene module are absent from production JavaScript. The remaining Vite large-chunk warning predates this work. Hardware performance still needs physical-device checks.

Use View nest for close-up inspection and Overview to return to the reference layout. Artwork thresholds and mascots are preview-only. Authoritative nest membership, persisted score ingestion and winner finality must be integrated before a public Season release.

## Opus art and motion pass

Built on the preview structure above. Everything remains development-only (`?season-preview=1`), absent from production JavaScript, and never touches `src/sim`, `config.ts`, payments, identities or the permanent residents.

- **Construction kit** (`src/render/season/craft.ts`): procedural woven courses (wefts over stakes plus a packed-fibre band), dome ribs, thatch bundles over a straw shell, loose bedding, fabric with per-company weave, deterministic so every viewer sees the same nest.
- **Personality**: NVIDIA tall faceted skep with green sash and banded crates; Apple smooth hemisphere, linen canopy and an apple basket; Amazon low wide dome, stacked parcels and a pull cart. Shared language: straw, twig, plank, brass, rope.
- **Build tiers** (visual only): 4 / 20 / 32 / 39 pieces. Pieces arrive in order (drop with landing squash, grow, unfold, pop) with dust puffs; losing a tier crumbles pieces in reverse. Mascots bring bedding while the nest is under construction.
- **Mascots**: ethogram-based behaviours (sniff with whisking, rearing, cephalocaudal grooming, bedding work, carrying food in the mouth, nose-to-nose and a short play bout, freeze then flee, hide, cheer with hops). Turn in place before walking, personal-space separation, routes that detour around the woven wall. `BlenderRatVisual.gesture()` and `mouth()` are cosmetic hooks used only by these mascots.
- **Flag**: double-sided cloth (name reads on both faces), pinned at the pole, travelling waves plus gusts, droops when a rival wins. A licensed logo placed at `public/season/flags/<TICKER>.png` replaces the wordmark automatically; no logo artwork ships in this repository.
- **Feed**: parachute sack sways down, canopy collapses, dust puff, `+20`, mascots rush over and carry seed inside.
- **Shield**: woven-light dome rising from the ground, fresnel rim, scan band, pixel dissolve; blocks the next strike (the snake bounces off).
- **Snake** (`src/render/season/SeasonSnake.ts`): leaves the existing den hole, lateral undulation where every body ring follows the head's own trail, short coil and <0.15 s lunge, impact shake and straw burst, U-turn and return into the hole. The score change lands on impact. It never harms residents.
- **Winner**: camera flies in (user drag returns control at once), golden ring, crown descends and lands with a bounce, mascots rear and hop, five firework shells in the company colour, rival flags droop.
- **Controls**: glass nest cards, score count-up with +/- deltas, stage track, busy progress on each action, ripple and hover feedback, hovering a card highlights its nest in 3D. Reduced motion disables all of it.

### Budgets and limitations

- Particles share one pool: 192 / 128 / 72 / 40 by AdaptiveQuality level, 0 under reduced motion. Flag normals update every other frame at economy and below; lantern lights only at high quality.
- Fully built scene (all three nests at 3,000+): about 390 Season drawables and 526k triangles, most of it the six LOD-0 mascots. Before a public release, merge each nest's static pieces once construction settles (≈15 draws per nest) and cap mascot LOD.
- The snake path ignores tunnels; routes chosen for the three current nests clear them. Grooming approximates forepaw strokes with head and chest motion; the rig has no arm-to-face IK.
- Verified with software rendering only (about 2 fps real time, frames stepped with a virtual clock). Check real phones and laptops.
