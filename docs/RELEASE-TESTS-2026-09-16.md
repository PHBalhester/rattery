# Release-gate testing — 2026-09-16

## Completed
- PostgreSQL 18 local integration: 12 test groups covering real SIWE signatures, 12 concurrent nonce uses, 24 competing mint reservations, 16 finalization retries, duplicate receipts, ownership, rollback/RPC outage recovery, expired challenges/sessions and HTTP limits by wallet/IP.
- Real database restart and pg_dump/pg_restore: world hash plus rat, intent, receipt and event counts preserved.
- Genealogy cycle/identity constraints, death records, bounded memorial pagination and stale-checkpoint rejection.
- Existing 18 controlled suites passed again.
- Historical USD candidate: 10,000 deterministic round trips, exact tier boundaries, missing/stale/future/unapproved quote behavior. Not connected to the live ruleset.
- Tail collision regression: 72 cases; tested obstacle penetration metric zero with protection enabled. This does not establish full mesh collision or rat-to-rat tail collision.
- Public HTTPS staging: https://rattery-staging.vercel.app; visibly labeled, demo-only, no real financial endpoints enabled.
- Confirmed deployed security headers, GET-only chain endpoint, and 404 for environment/server source files.
- Chromium public-staging check passed without page errors, approximately 60 FPS on this desktop in a short sample.
- WebKit local short check passed without page errors, approximately 31 FPS; not a physical iPhone/Safari validation.

## Bug found and fixed
The deployed snapshot endpoint initially returned HTTP 500: Node ESM could not resolve an extensionless config import. Corrected the import to config.js and added a test that compiles and loads the actual ESM output. Redeployed endpoint now returns HTTP 200 with snapshot:null and Cache-Control:no-store in prelaunch mode.

## Environment limitations
Firefox's Windows executable failed to launch in this environment. Linux Firefox rendered the models/UI without page errors but the frame sample timed out (23 frames in 15 seconds). It is not marked as a performance pass.

Physical Android/iOS, actual Safari, battery/thermal measurements and 30–60 minute sessions remain pending. Short frame samples do not prove sustained performance.

Kaspersky requests appeared in the Windows Chromium environment; the Linux Firefox/WebKit runs did not show those origins. No antivirus setting was changed.

## Financial boundaries
Cryptographic test wallets were ephemeral and generated in memory. Burn receipts/RPC were controlled fixtures; no testnet/mainnet transaction was signed or broadcast by these tests. The persistent service is not enabled in the public client. Real testnet token/wallet execution, contract-wallet signatures, operator reconciliation and authoritative continuously running simulation integration remain pending.

A separate Neon database, rattery-staging-db, was provisioned on the free plan and connected only to the staging project. Remote database validation is tracked separately from local PostgreSQL results. No production database is used.

See [persistent service](PERSISTENCE-STAGING.md) and [release gates](RELEASE.md).
