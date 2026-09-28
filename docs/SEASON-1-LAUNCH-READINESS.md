# Season 1 — requested launch readiness

Requested opening: 2026-09-28 13:00:00 America/Sao_Paulo (2026-09-28T16:00:00Z).
Status: NOT SCHEDULED. This file records the requested time, not an active production schedule.

## Available implementation
- ui-clarity b8ed38b: public tutorial and historical burn leaderboard; Season gameplay buttons disabled.
- season-nests-art 94d53eb: development-only cosmetic preview and hardware GPU validation.
- permanent-core-release working tree: local Season rule model, atomic burn Solidity contract and validation documents. These files are not a deployed Season backend.
- src/render/seasonFeed.ts explicitly provides presentation arithmetic, not authoritative scoring or settlement; live feed publication is not connected.

## Required before automatic opening
1. Deploy and verify the action router, chain/token/runtime and production quote signer; integrate authenticated quotes, approval and atomic execution in the four action controls.
2. Persist the Season schedule and memberships; ingest canonical action events with idempotency, finality and recovery; enforce opening/closing using authoritative server/chain time.
3. Connect real stock and RATTERY pricing, recurring 10-minute colony scoring, weekly adjustment and eligibility accounting.
4. Configure and verify the settlement wallet, funding, fee receipts, stock token routes, 1% stock / 3% RATTERY slippage limits, payouts and buyback/burn execution.
5. Validate complete entry/feed/shield/attack and restart/replay behavior in staging, including closure and settlement, before enabling production.

GPU/UI success does not validate any of the financial or scoring paths above. No automatic opening should be represented as armed until its persisted schedule and end-to-end runtime have been verified. Existing production colony, identities and payment paths were not changed for this readiness check.

Evidence: src/copy/season.ts; src/render/seasonFeed.ts; permanent-core-release/docs/SEASON-1-ATOMIC-BURN.md (Limits and remaining integration); permanent-core-release/docs/SEASON-1-VALIDATION.md.
## Validation executed 2026-09-28 (approximately 11:55 Sao Paulo)
- Refreshed origin: no additional backend release on ui-clarity or season-nests-art.
- test:season1:rules: 42/42 passed. This is the standalone model; tests documenting unresolved cases do not mean those cases are production-ready. Recurring colony-state scoring is not covered by this model suite.
- test:season1:burn: 14 local EVM groups passed.
- test:season1:burn:fork: 14 groups passed against the real token on an isolated local fork; zero public transactions.
- Live https://rattery.tech loaded index-CIHvIFSb.js with no page errors. All four Season action controls disabled. Source confirms they have no execution handler; not merely a time gate.
- Live /api/burners: HTTP 200, 39 burns / 6 wallets. Live /api/observer: HTTP 200.
- Production source contains no caller of publishSeasonFeed, no Season quote/action endpoints or Season persistence migration. Contract remains in the separate local working tree; no verified production router configuration found in reviewed sources.

Decision: NOT READY for automatic gameplay opening. No production schedule was created and no financial or simulation state was changed. The successful tests validate available components, not a deployed end-to-end Season.