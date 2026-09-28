# Tutorial and burn leaderboard release — 2026-09-28

The tutorial and historical top-burner leaderboard are enabled in ui-clarity. Season gameplay has not started: SEASON_RULES_FINAL and SEASON_WINDOWS_LIVE remain false and the whitepaper button remains disabled. The nest-art preview is not part of this deployment. No main merge.

## Historical coverage

The original colony_burns ledger contained 6 events / 2,510,000 RATTERY / 3 wallets. A complete Transfer-to-zero query from launch block 65848849 through confirmed collector checkpoint 74786617 returned 39 positive burns / 14,595,000 RATTERY / 6 wallets. Each receipt and block hash was verified. Total mints minus totalSupply at the same checkpoint exactly equals the 39-event burn sum.

The 33 missing events were indexed transactionally after a private backup and a rollback rehearsal. Audit identifier: operator-burn-history-index-20260928. Existing ledger rows, colony state, simulation version, collector cursor and pending-effect queue were asserted unchanged inside the transaction. Historical rows are explicitly marked historical-index-only / simulationApplied=false and settled at sentinel tick 0, so they cannot enter the pending burn-effect queue. No past care, ownership, payment or colony benefit was replayed. The table schema did not change.

The observer role lacked access to colony_burns. Only SELECT was granted; INSERT, UPDATE and DELETE remain denied. The observer alone was redeployed; no worker or payment-service deploy.

## Validation

- burners-test.ts passed against local rattery_staging_test: SQL grouping/totals, auth/cache behavior and proxy validation.
- burn-leaderboard-browser.cjs passed desktop and mobile, including exact shares and no pre-Season nest membership.
- The protected Vercel preview /api/burners returned HTTP 200, 39 burns, 6 wallets, 14,595,000 RATTERY and six real leaderboard rows. No DEMO rows were displayed. All 17 tutorial steps passed in desktop and mobile without page errors.
- Public activation was enabled only after the preview endpoint passed. Production build includes the tutorial and leaderboard, excludes the nest-art preview and the stock/prize demo windows.
- UI layout checks cover 1440, 1024, 390 and 360 pixel widths in EN/ZH.

Preview used for endpoint validation: https://rattery-ma2pkr331-pedrohbalhester-2682s-projects.vercel.app

The real wallet signature/payment test remains deferred at the user's request. This release does not claim to validate a new real payment. The separate security-hardening branch remains outside this UI release.
