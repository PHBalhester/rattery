# Read-only shared colony observer

The staging preview uses `?view=shared-colony` with `VITE_STAGING=true` and `VITE_SHARED_OBSERVER=true`. The default demonstration does not change. No visitor advances biology or submits trades in observer mode.

`Dockerfile.observer` builds a dedicated Node service. Set `RATTERY_OBSERVER_MODE=staging-readonly`, `RATTERY_OBSERVER_DATABASE_URL`, verified TLS `RATTERY_OBSERVER_DATABASE_CA`, and a random 32-byte hexadecimal `RATTERY_OBSERVER_SECRET` through the hosting secret store. The database role has SELECT only on colony_state, trade_stream and colony_trades, no access to authentication tables, and defaults to read-only transactions. Keep PostgreSQL private.

GET /health is process liveness, not proof of current simulation data. GET /snapshot requires a constant-time checked bearer secret. Reads use a repeatable-read transaction, a shared 500 ms cache, single-flight queries, a 4 MiB response bound and a global 1,200 authenticated requests/minute cap. This does not replace edge abuse protection.

The Vercel staging proxy requires RATTERY_OBSERVER_ENABLED=true, RATTERY_OBSERVER_URL (HTTPS Railway /snapshot only) and the same server-side secret. It accepts GET only, rejects redirects, bounds upstream time/size and exposes opaque errors. No credential is sent to the browser. Responses exclude care/account state and carry paymentsEnabled=false. A one-second public cache coalesces visitors; capacity and cache behavior still require production-scale measurement.

Browsers poll at 500 ms when visible and 5 seconds when hidden, reject older revisions, flag observations older than 15 seconds, retain the last state during outages and never fall back to a local simulation. Presentation interpolates positions between confirmed snapshots. Full historical genealogy is not included: it needs paginated retrieval from the persistent archive.

Checks: `npx tsx scripts/observer-test.ts`, `npx tsc -p server/tsconfig.observer.json`, normal build and API/server typechecks. `node scripts/observer-browser.cjs` expects a fresh Vite server on port 5191 with the staging/shared flags and verifies two observers, no local biological advance, older snapshot rejection, offline recovery and reload using synthetic responses. Restart Vite after changing store code before this test to avoid HMR module duplication.

Rollback: disable RATTERY_OBSERVER_ENABLED and remove the preview build flag, then redeploy staging. Do not reset colony_state or delete rat_records. Observer publication does not require changing or restarting the authoritative worker.

Public smoke check: `node scripts/observer-public-browser.cjs` passed against staging with two browsers on the same revision, outage/recovery, no page errors, payment data omitted and the default demonstration preserved. The observed snapshot was approximately 34 KB. This is a functional check, not a load benchmark.

## Second run (2026-09-17)

The first database was retained unchanged after its worker stopped, with four rat records and 2,359 applied trades. The operator authorized a private local full archive; SHA-256 and pg_restore catalog checks passed. This is not a full restoration drill. No archive or credentials belong in source control.

The worker now uses a separate migrated database with current simulation code explicitly versioned as shared-colony-v3. Bootstrap is disabled in configuration for subsequent deployments after initial creation. Its collector starts from a freshly queried head minus 64 blocks, not the old run's cursor. The observer carries RATTERY_OBSERVER_RUN_ID=rattery-staging-round2. Browsers reset revision/interpolation on a run change, retain states during outages and reject a retired run if an old cached response arrives.

Local tests include the run transition and rejection of an old run. Public two-browser testing passed with four living rats and matching revision/engine, no JavaScript errors, and offline recovery. A separate read observed advancing revisions and movement in three rats. The old database revision remained unchanged. The public archive UI, restoration drill, resource calibration and load/soak acceptance remain pending.
