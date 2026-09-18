# Event-first market collection

Deployed to the existing staging worker on 2026-09-18 UTC; see deployment update below.

The collector scans the two canonical market log filters first, fetching only event block headers and the range-end checkpoint. Event headers and the endpoint are re-read before an atomic commit, and the persisted anchor is checked both before and after collection. At least20 confirmations, chain identity, exact log/transaction membership, duplicate rejection and pending-price behavior remain mandatory. Adjacent fetched blocks must link through parent hashes; timestamps cannot move backwards.

For gaps this relies on a consistent canonical RPC and complete log responses. It does not independently prove every intermediate parent link or detect a provider consistently omitting logs. It must not be described as cryptographic ancestry verification across skipped blocks. A changed committed anchor durably halts ingestion. Mid-scan changes reject the range without advancing the cursor. No synthetic empty blocks or fabricated parent hashes are inserted.

The ledger stores real event blocks plus the range-end checkpoint. Existing dense history remains valid; no schema migration or deletion of historical rows is required. Commits compare the expected cursor/hash under the world lock. Stale writers reject; exact replay does not duplicate effects. The original dense ingest API retains its contiguous-block checks.

When more than half of scanned blocks contain logs, use dense header collection and recheck the end of the verified contiguous range. This avoids doubling calls in high-volume periods.

## Measured local fixtures (100-block range)

| Case | Previous calls | New calls | New stored block rows |
|---|---:|---:|---:|
| No trades | 107 | 8 | 1 |
| One curve event block inside range | 107 | 10 | 2 |
| Curve trades in every block | 107 | 107 | 100 |

Empty-range RPC calls fall92.5%. At the published Alchemy method weights, the empty-range cost falls from2190 to210 CU (90.4%). These are per-range fixture results, not a measured monthly bill. Pool transaction reads, initial discovery, restart, retries, payment reads and real event density add cost. Poll cadence remains5seconds plus processing time and error backoff; merely reducing concurrency would not achieve this CU saving.

Passed: eight collector groups, ten ledger groups, server typecheck and worker build. New cases include empty/mixed/dense ranges, restart after a sparse checkpoint, stale commit rejection, RPC outage, out-of-range logs, endpoint reorg, intermediate event reorg, unchanged cursor on failure and persistent halt after anchor reorg.

Deployment remains pending: Alchemy most recently returned monthly capacity exceeded; no hosted endpoint replacement or worker deployment was made as part of this change. Preserve the existing colony and its ledger identity on rollout.

## Deployment update — 2026-09-18 UTC
Paid Alchemy endpoint returned chain4663 and a block successfully. The final RATTERY historical test passed at block65848861:25 RPC calls, one verified trade, real Coinbase quote and local PostgreSQL application.
Endpoint saved in the authorized private local file and server-only Railway RATTERY_MARKET_RPC / encrypted Vercel staging RATTERY_RPC. No browser key or GitHub secret.
Railway deployment c0ef0bd1-c197-4bdb-b91e-18f7c06fb500 uses the two updated collector/ledger files atop the existing v6 curated source. Initial startup failed; after the previous instance stopped, a restart succeeded. The exact first failure was not logged. Worker_started,biology_ok and market_ok were observed; market accepted100 empty blocks,lag21800. Catch-up remains pending; no reset or identity/token migration.
Vercel staging deployed successfully at rattery-staging-6wc4zk901-pedrohbalhester-2682s-projects.vercel.app. Existing shared world remains rattery-staging-round3 and its market token remains ZZZ. Payment execution remains off. This is RPC/collector rollout, not final production launch.
