# Launch status — 2026-09-17

Staging is available over the custom HTTPS hostname. Wallet sign-in has passed staging checks; real payments remain disabled. The read-only collector and simulation worker have been exercised with PostgreSQL persistence and restart recovery. A separate shared-world staging preview now reads the hosted worker through a read-only observer and a server-authenticated proxy. The default demonstration remains separate. The first test colony reached extinction and is preserved in its original database. The second run also reached extinction under the previous fast resource depletion. A third, calibrated run now uses a separate database; no historical rows or deaths were overwritten. A private local archive of the first database passed checksum and archive-catalog validation (not a full restoration test).

## Remaining acceptance work, in order

1. Evaluate the third shared-world run and integrate paginated persistent memorial/genealogy retrieval. Resource depletion and prolonged isolation have been calibrated and tested through twenty simulated days without trades; longer real-feed observation remains necessary. Snapshot delivery, stale indication, reconnect and two-browser consistency have automated coverage; long-running public load is still pending.
2. Exercise the complete payment/ownership service with a generic test token, including duplicate requests, interrupted confirmations and recovery. Validate the final RATTERY contract and configure its address only when supplied. Stage authentication is not production payment approval.
3. Operate staging for 24–72 hours and measure RPC/price-source reliability, lag, CPU, memory, database growth and costs. Set alerts and scheduled offsite backups; repeat restoration. The existing same-volume restore was only a smoke test.
4. Test physical Android/iOS and Safari, mobile wallets/networks, accessibility and long sessions. Automated browser and emulated viewport checks do not replace devices.
5. Complete financial/security review, deployed rate-limit and abuse tests, asset/audio rights and license decisions, repository/publication checks, and rollback/incident procedures before activating production.

## First-visit tutorial

Four short steps explain the colony, resident selection, condition panels and viewing controls. English and Simplified Chinese follow the existing language setting. Next advances, the final action finishes, and Skip or Escape dismisses at any time. Help in the footer reopens the guide.

Completion or skipping stores only `rattery:welcome-tour:v1=done` in browser localStorage. It is per browser/origin, not a wallet/account preference. Clearing storage makes the guide appear again. If storage is blocked, dismissal still works for the current visit. The guide never calls wallet methods, submits payments, or mutates the simulation.

Validation: `node scripts/welcome-tour-browser.cjs` covers first visit, four steps, completion and skip persistence, Help replay, Escape/focus restoration, English/Chinese, 1280px/390px bounds and blocked storage. Set RATTERY_TEST_URL to run against staging.

## Minted resident labels

Minted residents display their chosen name above the animated head using small translucent screen-sized labels. Local demonstration ownership comes from care.owners; the public observer derives only a boolean minted flag from authoritative ownership, without exposing the wallet/account map. This display metadata never authorizes actions. Unminted or dead residents have no name tag. Names use textContent, follow camera/pose changes and receive bounded overlap avoidance; labels do not capture pointer events.

The mating studio demonstrates Pump on the lower rat and Pons on the upper rat. These are preview labels, not real mint transactions. Browser checks cover name mapping, following motion, overlap and mobile bounds. Payments remain disabled.

## Resting stress revision

Engine v5 relaxes toward a 12% healthy-resource baseline, with continuous food, water and temperature contributions. Recovery is gradual; trade reactions and individual distress remain active. Three 60-day regressions passed. The existing third run was upgraded in place with an operator-only checkpoint; rats, clock, RNG and ledger history were not reset. See [transition and test results](../deploy/STRESS-V5.md).


## Financial integration progress — 2026-09-18

The mainnet persistence path is implemented behind a fail-closed adapter in api/payment.ts. It requires exact host rattery.tech, RATTERY_PAYMENTS_ENABLED=true, chain4663, the final RATTERY address, a Railway PostgreSQL production URL with verified CA, and read-only HTTPS RPC. Auth sessions are isolated by origin, chain and token digest. The adapter exposes challenge/verify/session/logout and reservation/submission/finalize operations only; there is no endpoint to replace world state.

Local PostgreSQL tests with synthetic mainnet4663 receipts passed 13 groups: exact-domain/network SIWE, single-use challenge race, 24-way reservation race, idempotency, wallet ownership, one broadcast gate, RPC outage, rollback, service recreation, receipt uniqueness, recovery after intent expiry, review on changed eligibility, genealogy integrity, HTTP CSRF/body/rate limits, logout/expiry. No mainnet transaction was broadcast.

The production Vercel project currently has no payment environment variables or production database. Therefore the adapter remains unavailable and the public UI does not claim that mint/care is live. Required activation work: provision isolated PostgreSQL production database, run migrations 001–008, set encrypted CA/RPC/database secrets, create a production client flow calling /api/payment, perform hosted end-to-end with a small authorized burn, reconcile and alert, then enable the flag.
