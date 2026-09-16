# Read-only market collector and continuous worker

## Implemented scope

The collector verifies chain 4663, the factory launch event at the exact birth block, native ETH as quote asset, the curve address and the deterministic canonical Pons v4 pool ID. Configuration is pinned in PostgreSQL. It queries only allowlisted read RPC methods over HTTPS. There are no signing keys or broadcast methods.

Each poll revalidates the persisted anchor against the RPC, waits at least 20 blocks, fetches at most 100 contiguous headers (eight concurrent requests), and queries the curve/pool logs by range. It validates emitter, topics, block/hash membership, removed status, duplicate positions, exact integer ETH amounts and swap signs. Pool transaction origins are checked against block membership; they may be relayers and are not treated as beneficial owners. The final block and persisted anchor are checked again before an atomic batch commit. A changed anchor halts the stream persistently.

Twenty confirmations are a configurable depth policy, not a cryptographic proof of finality. One RPC remains a trust dependency: a malicious provider can omit data consistently. Independent-provider comparison and full secondary-pool discovery are not implemented here. Only the native-ETH curve and canonical Pons pool are included.

## Historical ETH/USD

Source: Coinbase Exchange ETH-USD, closing price of the immediately preceding fully closed one-minute candle. The candle close is timestamped at its interval end, never after the trade. Quotes are cached persistently by source/minute and the first committed value wins. JSON price numbers are rounded once to six decimals, then trade valuation uses integer arithmetic. This is a deterministic simulation reference, not the user's exact execution price or a financial oracle.

Missing/invalid/error responses leave verified trades pending. Retrying resolves them without changing an already classified event. Later events wait behind the first unpriced event while biology continues. The provider can omit intervals and historical values can be revised upstream; committed quotes are never silently replaced.

Source documentation: https://docs.cdp.coinbase.com/api-reference/exchange-api/rest-api/products/get-product-candles

## Evidence

- Seven controlled PostgreSQL collector groups cover discovery/configuration, network mismatch, removed/duplicate/mismatched logs, provider outage, closed-minute selection/cache, immutable prices, exact curve/pool amounts, transaction membership, restricted worker credentials, canonical-anchor change and write-method rejection.
- Ten ledger groups include atomic batch failure and overlapping suffix retries.
- Worker runtime tests cover no overlapping work, backoff, awaited shutdown and sanitized error reporting.
- Live bounded read-only test: ZZZ 0x7dbf38976f6d3b9c529e7d9484a71898b409ee6a, block 54672454. A real 0.5 ETH curve buy used an ETH/USD reference of 2454.78, yielding USD 1227.39 / giant. Final run used 25 RPC reads and wrote only to isolated local PostgreSQL. No wallet or blockchain transaction was used.
- The previously captured block 63165020 had no trades in this collector's canonical scope; alternative pool activity is not proof of canonical coverage.

Run npm run test:market:collector, npm run test:trades:ledger, npm run test:worker:runtime and npm run build:worker. The optional npm run test:market:live requires a local PGDATABASE ending in _test; it has an 80-call read budget and is not run in CI. Raw live captures remain ignored under test-results/market-collector.

## Deployment boundary

The user selected Railway Hobby. See ../deploy/RAILWAY-WORKER.md for the concrete build/start commands, variables, restricted grants and acceptance checks. The worker holds a session advisory lease, uses verified database TLS, refuses a non-staging database name, runs no public HTTP/payment server and emits sanitized metrics. Migrations 001–006 run separately with operator privileges.

No Railway service has been provisioned yet. Railway account access, agreed spending controls, a dedicated database/runtime role, restart/latency/throughput monitoring and public snapshot integration remain required before exposure. Local tests do not establish managed-host performance at maximum colony population. Public staging remains unchanged/authentication-only.
