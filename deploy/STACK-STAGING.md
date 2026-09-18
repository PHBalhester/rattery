# Selected staging stack

Decision: GoDaddy + Cloudflare + Vercel + Railway + Robinhood public RPC.
This document is a rollout plan and partial validation record, not evidence of a completed deployment.

## Responsibilities

- GoDaddy: domain registration and renewal for rattery.tech.
- Cloudflare: authoritative DNS after a reviewed zone import and nameserver change. Use DNS-only for Vercel records; do not stack an unvalidated reverse proxy in front of Vercel.
- Vercel: frontend and existing same-origin session API. Keep auth cookies, SIWE domain/origin and allowed origins tied to the exact staging hostname.
- Railway: continuous collector/simulation and a dedicated PostgreSQL database. Keep worker/database communication private where supported. Do not expose the worker or PostgreSQL publicly just to make them reachable from a browser.
- Robinhood public mainnet RPC: bounded read-only collection for staging. No transaction sending, wallet keys or stress tests against the public endpoint.
- Coinbase: existing historical ETH/USD source remains an external dependency; the selected RPC does not provide USD prices.

Cloudflare DNS-only does not provide Cloudflare HTTP caching or WAF protection for those records. Vercel continues to deliver the site and enforce its HTTP protections.
The existing Vercel auth environment still uses its existing database. Moving it to Railway is a separate migration, with verified TLS, a restricted role and backup/restore validation; it is not done by selecting this stack.
The worker currently has no public shared-world delivery endpoint. Complete that layer before claiming observers receive the Railway world.

## Evidence: 2026-09-16

- Public DNS: rattery.tech nameservers are ns07.domaincontrol.com and ns08.domaincontrol.com. Cloudflare delegation has not happened.
- staging.rattery.tech: public lookup returned NXDOMAIN.
- https://rattery-staging.vercel.app/: HTTP 200 over verified HTTPS; HSTS, nosniff, frame DENY, CSP and Permissions-Policy present.
- `node scripts/staging-login-browser.cjs`: PASS on deployed staging. Disposable wallet signature, secure HttpOnly session, sign-out, rejected signature, account switch during signing and wrong network. Payments disabled. No transaction RPC.
- `npm run test:market:live`: PASS, 25 read-only RPC calls, one canonical historical trade at block 54672454, historical Coinbase quote, application to an isolated local test schema. This is not a live-throughput or Railway integration test.
- `npm run test:worker:runtime`: PASS; no overlapping work, error backoff, awaited shutdown and sanitized errors. Local test, not a hosted restart exercise.
- No Railway service or Cloudflare zone was created by this validation. No domain or deployment was changed.

## Remaining integration acceptance

1. Obtain access to the selected Railway and Cloudflare accounts. Inspect existing resources before creating any duplicate.
2. Import and reconcile all existing DNS records, including mail/verification records and DNSSEC state, before switching nameservers. Preserve root/www until their intended deployment is verified. Use provider-supplied values, not guessed CNAMEs.
3. Add staging.rattery.tech to the staging Vercel project, verify ownership, set DNS-only, and validate TLS and hostname redirects. Update exact SIWE origin/domain configuration and rerun the browser login test on the new hostname.
4. Provision the isolated Railway staging database and worker following RAILWAY-WORKER.md. Validate TLS compatibility for the actual connection path; do not disable certificate verification to make it work.
5. Test persistence with no visitors, restart/redeployment, backup restoration, RPC/price outage recovery and canonical cursor continuity. Inject outages locally or in our own service; do not load-test the public RPC.
6. Add and validate shared-world delivery, origin/cookie rules, stale-data signaling and consistent observations across two browsers.
7. Run a 24-72 hour hosted observation with CPU/RAM, database size, network, RPC counts/rate limits, biology lag and chain lag. Define costs/alerts from measurements. Keep payments disabled.

## Provider constraints

Vercel commercial production needs an appropriate plan. Railway resources and backups are usage-billed; Pro is not unlimited usage. Railway database templates still require backup/access/maintenance configuration. Robinhood explicitly rate-limits its public RPC and does not recommend it for production: a successful staging test does not establish a production SLA.

References:
- https://vercel.com/kb/guide/cloudflare-with-vercel
- https://docs.robinhood.com/chain/connecting/
- https://docs.railway.com/databases
- https://vercel.com/docs/plans/hobby


## Hosted validation update: 2026-09-17 UTC

The approved existing Railway Pro project was reused. An isolated staging environment now contains PostgreSQL and a read-only collector/simulation worker. Existing frontend deployments were not changed.

Verified:
- PostgreSQL 18.6 has no public TCP proxy. Migrations applied with an operator connection; runtime role is restricted and cannot read auth sessions or insert burn receipts.
- TLSv1.3 database connections with certificate and hostname verification. A private CA is supplied through the optional RATTERY_WORKER_DATABASE_CA service variable; private keys never enter source control.
- Dockerfile.worker builds with locked npm dependencies and runs as non-root. Corrected a Railpack cache/install conflict and included shared API libraries in the Docker build.
- Worker runs one replica with no public domain, no sleeping and three maximum failure restarts. Financial execution remains disabled.
- Live read-only mainnet collection produced 21 applied trades and six historical quotes at one observation. This is not a throughput guarantee.
- Hosted worker restart preserved state/cursor and resumed processing. Two transient market errors recovered with backoff. Build-time catch-up still required observation.
- Logical backup restored into a separate test database. This was a same-volume smoke test, not an offsite or scheduled backup policy.
- Cloudflare Free zone added and existing public records imported as DNS-only. Registrar delegation has not changed. Existing frontend still does not consume the hosted worker world.

Remaining: reconcile full registrar DNS zone and DNSSEC, activate Cloudflare delegation, configure custom staging hostname and SIWE origins, deliver shared world to browsers, schedule offsite backups and cost alerts, and measure 24-72 hours of hosted operation. No hosted payments enabled.


## Custom staging hostname

Public DNS delegation to Cloudflare is active. Added `staging.rattery.tech` to the staging Vercel project and created the provider-recommended CNAME in Cloudflare in DNS-only mode. Vercel reports the domain verified and DNS correctly configured. Apex/www destinations remain unchanged.

The session adapter supports an explicit custom staging origin setting while retaining the original Vercel staging hostname. Each hostname gets its own SIWE handler; forwarded-host headers do not select the origin. Unrecognized configured origins and hostnames fail closed. Tests cover disabled auth, unknown hosts, suffix spoofing, forwarded-header spoofing and explicit activation of the custom domain. Hosted browser acceptance is checked separately before declaring the migration complete.

Acceptance completed: HTTPS returned HTTP 200 with verified certificate and security headers on the custom hostname. The deployed SIWE browser suite passed on BOTH staging.rattery.tech and the original Vercel hostname: disposable signature, Secure/HttpOnly/SameSite=Strict cookie, logout, signature rejection, account switch during signing, wrong network, no real payments and no transaction RPC. Public shared-world delivery remains a separate pending task.
