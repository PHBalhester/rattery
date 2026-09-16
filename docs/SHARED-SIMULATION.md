# Persistent shared simulation (local milestone)

The worker advances the existing rat biology engine from the PostgreSQL world snapshot. Care finalization and ticks lock the same colony row and commit their world changes atomically. A browser cannot upload a replacement world or advance time.

## Invariants
- Simulation tick, wall-clock cursor, RNG state, world and revision persist in the same transaction. Independent workers calculate only the time still due after acquiring the row lock; they cannot multiply time progression.
- Each transaction processes at most 40 fixed 100 ms ticks. Excess downtime remains as backlog; it is not discarded. A regressed host clock cannot rewind the cursor. New reservations and pending payment application wait when an active simulation is more than one second behind.
- Engine version pins an explicit model version and CONFIG fingerprint. A mismatch fails closed. Physics/behavior changes require an intentional version bump and migration/replay decision; a fingerprint of configuration alone does not detect all code changes.
- Rat iteration is sorted by ID before every server tick because PostgreSQL jsonb may reorder object keys. This prevents restart/batch boundaries from changing random-number assignment. The shared engine is an explicit new server mode, not an implicit migration of the public demo.
- Historical rat records and genealogy stay in persistent tables as live snapshots evolve. Death does not erase minted ownership or the rat's identity.
- Client observers fetch committed snapshots and never run biology or trade application locally. Revisions prevent delayed responses from replacing newer state.

## Validation
Nine real PostgreSQL test groups cover 12 competing workers racing with mint, concurrent feeding, stale snapshots, repeated process reconstruction, RNG/world equivalence across batches, transactional rollback, bounded catch-up, regressed time, independent readers, incompatible engine version, memorial retention and background execution without observers.

The local fork/browser test also runs the continuous worker. Mint, feed and water use three real local EVM burns. Two 3D observers receive the persisted ownership/care and continue across an observer reload. Public observation uses the same snapshot route without requiring a wallet.

Run migrations 001 through 005 only on an isolated test database and execute `npm run test:simulation:shared`. The fork/browser harness remains described in MAINNET-FORK-TEST.md. Its UI routes are localhost-only development views: `?view=care-lab` and `?view=shared-colony`. CI verifies they are omitted from production bundles.

## Deployment boundary
This worker is currently tested locally. Public Vercel staging still exposes authentication only; no paid-care or shared-worker endpoint is enabled there. Do not run an endless worker inside a request-scoped serverless function and assume it will remain alive.

Before public activation: integrate the authoritative trade ingestion cursor/event ledger; choose and validate an always-on worker host with monitoring; test managed database latency, data volume and snapshot delivery/interpolation at target population; provision a dedicated least-privilege worker role; define bounded reconciliation and backup operations; validate actual wallet extensions and the final token. The current full-world polling endpoint is a local validation adapter, not a proven scalable streaming design.

The final browser run used source block 64698677 and included an anonymous observer with no wallet session. It retained exactly three local burns. Recovery UI polls outstanding submissions without rebroadcasting, ignores older database revisions, and reads world plus intent state in one PostgreSQL snapshot. Observation uses a separate rate bucket so refreshing a pending payment cannot exhaust the wallet mutation limit. These paths are covered by the browser test and the persistence suite.

The local market ledger is now implemented and tested; see [SHARED-TRADE-LEDGER.md](SHARED-TRADE-LEDGER.md). Live RPC collection, historical quote sourcing and public worker hosting remain pending. Engine version advances to v2 for the changed tick semantics.
