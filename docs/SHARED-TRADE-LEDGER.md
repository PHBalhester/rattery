# Shared trade ledger — local implementation

## What is implemented

Migration 005 adds a single pinned chain/token stream, an accepted block cursor and a persistent trade ledger. The server accepts contiguous, ordered blocks from a trusted collector boundary. Empty blocks also advance the cursor. Log identity, block position and canonical payload fingerprints prevent retries from duplicating events or silently changing accepted data.

The existing historical USD valuation stores the exact ETH amount, price source, quote timestamp, USD micro-units and ruleset version. Sources must be explicitly allowed. Missing quotes stay pending; no fixed fallback price is invented. A valid later quote can resolve a pending event once. Classified values cannot be overwritten.

Each biology tick consumes an ordered prefix of at most 200 queued trades under the same PostgreSQL lock/transaction as the world, RNG and care. The existing approved trade-effect model applies the effects. The ledger status, simulation time and world commit together. Multiple collectors/workers and process restarts cannot apply the same event twice.

Late quotes do not rewrite history: raw block time remains in the ledger, while the effect receives a separately persisted application tick/time. This is a live shared-colony policy, not genesis-time market replay. An earlier pending quote delays later trade effects, but biology and care continue. A changed accepted block or parent mismatch persistently halts market effects for operator review; no automatic rollback of paid actions is attempted.

Engine version is now shared-colony-v2. Existing v1 state deliberately fails the version check. Do not change its version field blindly: use a new isolated colony or a reviewed migration/replay plan.

## Evidence

Run migrations 001–005 in an isolated PostgreSQL database, then:

- npm run test:trades:ledger
- npm run test:simulation:shared
- npm run test:persistence
- npm run test:server:esm

The ledger suite covers competing ingestion/worker calls, empty blocks, gaps, wrong tokens, duplicate logs, missing/stale/untrusted quotes, immutable valuation, database rollback, restart recovery, exact USD tiers, bounded bursts, future/excessive inputs, sell effects, changed blocks and parent mismatch. Inputs/quotes are controlled fixtures; this is not evidence of a live price feed or an operational RPC collector.

## Remaining activation work

TradeLedger is operator-only and has no public HTTP mutation. Its caller still needs a real read-only collector that verifies RPC chain, confirmation depth, canonical block/log membership, launch/curve/pool decoding and continuity against the persisted anchor on every restart. Supplying a MarketBlock object alone does not prove blockchain authenticity. Deep reorganizations outside supplied blocks require explicit anchor checks and reconciliation.

Also pending: a historical quote provider, retries/alerts for pending quotes, a bounded initial backfill policy, persistent worker hosting, least-privilege worker credentials, monitoring and restore/reconciliation rehearsal. The current ledger does not infer new holders, so it does not award new-holder bonuses from unverified data.

The public staging site remains authentication-only. No live trade ingestion, shared public worker or real paid-care transactions are enabled by this change. Vercel request functions have finite lifetimes and are not an always-on simulation host: https://vercel.com/docs/functions/limitations.
