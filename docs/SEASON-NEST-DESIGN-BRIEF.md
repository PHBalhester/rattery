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
