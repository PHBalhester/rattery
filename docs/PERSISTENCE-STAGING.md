# Persistent staging service

This milestone is an isolated server-side test implementation. Staging now exposes wallet sign-in; payment buttons and public financial execution remain disabled.

## Implemented and tested
- PostgreSQL 18 migration: authentication challenges/sessions, authoritative world checkpoint, immutable rat identity/death, genealogy foreign keys, intents, receipt uniqueness and action journal.
- SIWE challenges bound to configured origin, chain 46630, expiration and a cryptographic nonce; EOA signature validation and atomic nonce consumption.
- Opaque sessions stored as SHA-256 digests. HTTP adapter sets HttpOnly/SameSite=Strict and Secure on HTTPS cookies, checks Origin and limits JSON bodies to 8 KiB.
- One open reservation per rat; stable request idempotency. Unique receipt and chain/token/transaction indexes prevent reuse across intents.
- Exact burn verification using the existing verifier, followed by one database transaction for receipt + action + state.
- Confirmed burns within their original time window can be recovered after an app timeout. Reservations are not automatically released on expiry.
- If a valid burn arrives after a rat becomes ineligible, retain a review record and receipt rather than lose evidence or request a second burn.
- Paged memorial reads (max 50) and revision-checked operator checkpoints.
- An isolated PostgreSQL CI service; no production secrets or testnet transactions.

## Run
Provide an isolated PostgreSQL database ending in _test via standard PGHOST/PGPORT/PGUSER/PGDATABASE variables, then:

```sh
npm ci
npm run typecheck:server
npm run test:persistence
npm run test:valuation
```

The test creates a uniquely named schema and retains it for backup verification. All private material stays in ignored local storage. Test signing keys are generated in memory; none is committed or sent to a chain.

The test database must never point to production. CI uses trust authentication only inside its disposable runner service; this is not a configuration for a public database.

## Verified cases
Real PostgreSQL locks/constraints, 12 competing nonce consumptions, 24 competing mint reservations, 16 concurrent completion retries, receipt reuse, foreign ownership, RPC failure, injected database rollback, reconstructed service, expired SIWE/session, logout, HTTP origin/body/rate guards, secure cookies, stale snapshots and invalid genealogy.

A real local PostgreSQL restart and pg_dump/pg_restore round-trip preserved the world checksum and counts of rat identities, intents, receipts and actions.

## Still required
- Scheduled encrypted managed backups and full hosted-service disaster recovery.
- Real testnet token deployment/funding plus explicit wallet confirmation of transactions.
- EIP-1271 contract-wallet authentication (current milestone accepts EOA signatures only).
- Payment UI, authoritative colony integration and financial deployment adapter (the staging sign-in adapter is implemented).
- Authoritative continuously running simulation/action replay integration.
- A bounded anti-abuse/reconciliation policy for abandoned reservations and paid review cases. Do not use automatic expiry to sell a rat twice.
- Operator resolution of review cases, financial monitoring and independent review.
- Scheduled retention of expired challenges/sessions/rate windows.
- Production TLS, cookies, CSRF, reverse-proxy trust and multi-instance validation.

No real payment is enabled by this milestone.

## Historical USD prototype
server/valuation.ts is a separate candidate ruleset. It computes exact integer micro-USD values, pins quote source/time, rejects future/stale/unapproved quotes and returns pending when no quote exists. Tests cover tier boundaries and 10,000 deterministic round trips.

The current colony still uses its existing fixed reference. A real quote provider, durable immutable quote ledger and replay migration are not yet activated.

## Hosted staging evidence
All 12 integration groups also passed against the separate Neon staging resource, in database rattery_staging_test with a unique test schema and verified TLS. Its backup was restored into a separate local PostgreSQL database and full row fingerprints matched across six persistent tables, including ownership and genealogy records.

The operator-only script `scripts/hosted-persistence-test.mjs` reads an ignored staging environment export, checks the linked staging project and disabled payments, and creates only the isolated test database. It suppresses raw connection diagnostics. Standard local/CI runs remain unchanged. Generic remote test connections may use RATTERY_TEST_DATABASE_URL, without query parameters; the database name must end in _test and TLS certificates are verified. Never put credentials in shell arguments or commit environment exports.

## Staging browser sign-in
The Wallet panel offers a separate, explicit SIWE sign-in on testnet 46630. The browser checks domain, account, network, statement and expiry before personal_sign. Connection alone does not request a signature. Account/network changes invalidate the app connection, and logout is queued after in-flight verification. Sessions use Secure, HttpOnly, SameSite=Strict cookies with a one-hour expiry. Challenges are additionally bound to an opaque browser cookie; only its digest is stored in PostgreSQL.

The public adapter is disabled unless staging and auth flags are enabled, uses a fixed canonical staging origin, and has no payment route. It connects to a separate authentication database with a runtime role limited to auth/rate tables, not ownership or receipts. It enforces IP/address/global limits, bounded expiry cleanup, body limits and verified database TLS. Local HTTP tests and deployed browser tests cover a real ephemeral EOA signature, logout, rejection, account changes during signing, and wrong network. No real-wallet transaction is requested.

See [mainnet fork evidence](MAINNET-FORK-TEST.md) for the separate local EVM payment test.

## Submission and recovery protocol
Migration 003 adds a single-use submission marker and optional recovery hash to intents. Authenticated overview returns at most 50 rats and 20 wallet-scoped intents. `beginSubmission` uses a conditional database update to allow one caller only; an expired or already-started attempt cannot open a second payment. `rememberSubmission` stores a hint and never authorizes an action; `finalize` independently checks the chain. Pending attempts remain held after cancellation/uncertainty until recovery or operator review. No automatic cancellation or resale is introduced.

The PostgreSQL suite now includes 13 groups, including 12 competing begin-submission calls and the fractional-second timestamp regression. See the mainnet-fork report for the browser recovery test. Public `/api/session` continues to whitelist authentication operations only; these payment methods are exercised solely by the local lab.
