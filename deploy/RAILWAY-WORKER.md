# Railway staging worker

The user selected Railway Hobby. This document prepares deployment; it does not create a subscription or service.

## Service settings

Create one service named rattery-market-staging from the reviewed repository branch. Keep automatic deploys disabled during validation.

- Build: npm ci --ignore-scripts --include=dev && npm run build:worker
- Start: node dist-worker/scripts/worker.js
- Node: 24 (the repository engines field pins the major version)
- Replicas: 1
- Restart: on failure, maximum 10 retries
- Serverless/automatic sleeping: disabled
- Public networking/domain: none; the worker has no incoming HTTP endpoints
- Region: as close as possible to the dedicated PostgreSQL database

Use the current Railway dashboard settings. The older railway.json Config as Code is deprecated for new services; do not introduce a legacy auto-deploy file.

## Variables

Set values through Railway Variables, never in source files or chat logs:

- RATTERY_WORKER_MODE=staging-readonly
- RATTERY_WORKER_DATABASE_URL: direct PostgreSQL URL for a dedicated database ending in _worker_staging. Use a restricted runtime role, verified TLS and no URL query parameters. Do not use a transaction-pooler hostname.
- RATTERY_MARKET_TOKEN: chosen test token, not a payment token
- RATTERY_MARKET_BIRTH_BLOCK: exact verified factory launch block
- RATTERY_MARKET_START_BLOCK: explicit first collected block. For a new live demonstration choose a recent confirmed block after measuring RPC head; do not accidentally backfill millions of blocks.
- RATTERY_WORKER_BOOTSTRAP=new-staging-colony: only for an intentionally new empty staging colony; remove after first initialization.
- RATTERY_MARKET_RPC: optional HTTPS read-only RPC endpoint

ZZZ was validated in a local historical test with token 0x7dbf38976f6d3b9c529e7d9484a71898b409ee6a and birth block 54672454. That old birth block is a test fixture, not the recommended live start.

Apply migrations 001 through 006 using a separate operator connection. Runtime credentials must not own tables or have schema creation rights. Grant SELECT/INSERT/UPDATE on colony_state and rat_records; SELECT/INSERT/UPDATE on trade_stream and colony_trades; SELECT/INSERT on trade_blocks and market_quotes; USAGE on the application schema. Do not grant access to auth_sessions, auth_challenges, care_intents, burn_receipts, rat_ownership or care_events. Initialization/worker paths do not need those financial/auth tables.

## Acceptance before routing observers

Verify startup, persisted advancement with no visitors, process restart, SIGTERM shutdown, provider downtime and price recovery. Watch biology lagMs, market lagBlocks and rssBytes for at least one representative session and at the target rat population. Missing quotes and market halts require operational alerts. This change emits structured logs but does not provision external alert delivery.

The collector batches at most 100 blocks / 2000 events, with eight concurrent header reads, per iteration. Verify sustained catch-up rate against actual chain production and RPC rate limits before public activation. It covers the Pons native-ETH curve and canonical v4 pool only. Alternative pools are not silently counted as supported.

Keep public paid care disabled. A public snapshot delivery layer, worker deployment smoke test, backup restoration, bounded data retention and secondary-pool coverage still need rollout validation. Existing Vercel staging and GoDaddy DNS remain unchanged.

Hobby includes $5 monthly usage, not a $5 spending ceiling. Configure cost alerts and an agreed hard limit in Railway; a hard limit can suspend the service. Database usage is separate if hosted elsewhere.

References:
- https://docs.railway.com/pricing/plans
- https://docs.railway.com/pricing/cost-control
- https://docs.railway.com/config-as-code/reference
- https://docs.railway.com/infrastructure-as-code/reference
