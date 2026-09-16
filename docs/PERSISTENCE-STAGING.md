# Persistent staging service

This milestone is an isolated server-side test implementation. It is not wired to the production browser's payment buttons and does not expose a new public financial API.

## Implemented locally
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
- Hosted PostgreSQL verification and encrypted managed backups (a separate free Neon staging resource has been provisioned).
- Real testnet token deployment/funding plus explicit wallet confirmation of transactions.
- EIP-1271 contract-wallet authentication (current milestone accepts EOA signatures only).
- Login UI/session integration and secure deployment adapter.
- Authoritative continuously running simulation/action replay integration.
- A bounded anti-abuse/reconciliation policy for abandoned reservations and paid review cases. Do not use automatic expiry to sell a rat twice.
- Operator resolution of review cases, financial monitoring and independent review.
- Scheduled retention of expired challenges/sessions/rate windows.
- Production TLS, cookies, CSRF, reverse-proxy trust and multi-instance validation.

No real payment is enabled by this milestone.

## Historical USD prototype
server/valuation.ts is a separate candidate ruleset. It computes exact integer micro-USD values, pins quote source/time, rejects future/stale/unapproved quotes and returns pending when no quote exists. Tests cover tier boundaries and 10,000 deterministic round trips.

The current colony still uses its existing fixed reference. A real quote provider, durable immutable quote ledger and replay migration are not yet activated.
