# Season I settlement operator runbook

## Current scope

The operator deposits the winning company's Stock Token into **0xd40ed0214353b746fd567fa4a57409d1b5709988**. The declared deposit is **entirely prize funding**, split 80% active / 20% passive. There are no fee collectors, acquisition swaps, buybacks, or operating deductions in this implementation. ETH pays gas separately. This follows the operator's October 1 instruction; it does not silently alter the published game scoring rules.

This is a standalone settlement tool. It is not enabled in the website, payment service, or scoring worker. No existing key is reused, no real contract is deployed by tests, and nothing is scheduled merely by merging the code.

## Rules implemented

- Season I only: Sep 28, 2026 13:00 to Oct 5, 2026 00:00, America/Sao_Paulo, with an exclusive ending boundary.
- Finalization requires a block after closing with 20 confirmations and all 930 colony checkpoints. Late checkpoint completion is allowed; incomplete checkpoints halt finalization.
- Weekly adjustment uses reviewed Sep 25 / Oct 2 regular-session references, consistent split adjustment, nearest whole point with halves away from zero. No cap; final score floors at zero.
- Tie: final score, gross entry/feed production, first reaching that production in block/log order, then NVDA/AAPL/AMZN.
- Only the wallet's final membership can receive active rewards. Switching forfeits earlier membership contributions. Entry/feed contributions and gross production reconcile with on-chain storage. Shields and attacks do not add weight.
- Active holding bonus is fixed at opening; direct historical balances must stay above the reviewed USD 100 token threshold for 7/14/30 days. Historical verified zero-address burns before opening qualify for the Season I 5% bonus at one million RATTERY. Future-season bonus progression is not invented for Season I.
- Passive balances are integrated across every transfer and its block timestamp for the entire gameplay window. A qualifying USD 25 average receives its full weight. Active bonuses do not multiply passive weights. A wallet may receive both shares.
- Team/treasury and identified protocol addresses are excluded. Contract wallets are not blanket-excluded. Review `config.ts` and additional exclusions before freezing a manifest.
- All arithmetic uses integer token base units. Each recipient rounds down. No-recipient pools and rounding dust remain separately recorded as active/passive rollover in the treasury. They are not reallocated to other recipients. Season I starts with no prior carry; future seasons need their own asset-aware carry accounting.

## Reviewed inputs and available evidence

Use a private archive RPC in `SETTLEMENT_RPC` (HTTPS). Do not paste a key into chat. The collector only has read RPC methods.

Create a references JSON from `docs/season-settlement-references.example.json`. Required inputs are the fixed opening holding thresholds, their evidence, the three pairs of regular-session closing prices, and additional excluded addresses. Thresholds are integers in RATTERY base units, not USD or token display units. Prices for each stock must use the same scale at both endpoints.

The example intentionally contains null values and is **not executable**. Do not fill them with current spot prices, rolling seven-day API changes, or guessed zero returns. The repository's earlier social-media simulation is not a final settlement manifest. Reviewed price references are an explicit operator input; this tool does not pretend to verify split adjustments from a text assertion. In Season I both scheduled Fridays are regular sessions; any calendar discrepancy requires review, not changing dates silently.

Collection reconstructs the complete transfer history from deployment, checks every reconstructed opening/closing wallet balance against the chain, reconciles total supply, and freezes anchor hashes. Snapshot and reference hashes are embedded in the distribution. Final results cannot be produced before the season has actually closed.

## Prepare the report (read-only)

Use Node 24, the repository lockfile, and solc **0.8.24**. `RATTERY_SOLC` can point to that compiler. No new runtime package is required.

```sh
npm run settlement -- collect /private/references.json /private/snapshot.json
npm run settlement -- prepare /private/snapshot.json /private/references.json TOKEN_AMOUNT /private/new-settlement-directory
```

`TOKEN_AMOUNT` is the exact declared deposit in **stock token display units**, not USD. Preparation independently recollects the snapshot at its original anchor and requires an identical evidence hash, then checks that the treasury holds that amount. It does not sweep unrelated balances or automatically add later donations. Token decimals come from the selected token contract.

Outputs:

- `bundle.json`: complete inputs, snapshot, winner ranking, per-wallet active/passive amounts, rollovers, deployment, Merkle proofs, and manifest hash.
- `payments.csv`: full wallets and amounts in integer stock token base units.
- `transactions.json`: unsigned deployment, exact approval, and funding calls.

Outputs use exclusive creation; existing files/directories are not overwritten. Review the bundle and archive it before any signature. Preserve it through settlement and future rollover reconciliation.

## Sign deployment and funding

Set `SETTLEMENT_APPROVED_MANIFEST` to the exact reviewed manifest hash. This is an approval binding, not a private key.

```sh
npm run settlement -- serve /private/new-settlement-directory/bundle.json
```

Open the printed **127.0.0.1** URL in a wallet-enabled browser. The page connects only the treasury on Robinhood Chain. It shows the token address, decimals, exact amounts, reserve dust, recipient count and manifest. Download the complete report there if needed.

1. Sign deployment. A fixed deployment nonce determines the contract address and proof domain. If another treasury transaction consumes that nonce first, regenerate and re-review the entire plan **before** signing; do not edit JSON fields.
2. Paste/verify the deployment transaction hash after 20 confirmations. The verifier checks the exact reviewed creation bytecode, sender, nonce, chain, contract address, and constructor settings.
3. Approve the exact distributed amount, then fund the immutable distribution. Rollover stays in the treasury. The contract rejects early funding, non-treasury funding, funding twice, non-exact token transfers and a second payment of the same leaf.

If all allocations roll over, there is nothing to deploy/fund. Never deploy or fund a second distributor for the same season. The executor registry enforces one distribution per chain/season, but it cannot prevent an operator from manually funding a different contract outside this system.

The contract has no arbitrary transfer, recipient replacement, root update or rescue function. That is deliberate: an issuer-blocked recipient's amount remains reserved until their original address can receive it. Do not fund a knowingly incorrect manifest; it cannot be edited afterwards.

## Automatic distribution

Use a durable PostgreSQL database and a dedicated relayer with only an ETH gas budget. The relayer cannot change token recipients or amounts. **Do not use the colony scoring key**; the executor explicitly rejects its address. Keep secrets in the deployment secret store and never commit them.

Required environment variables:

| Variable | Purpose |
| --- | --- |
| `SETTLEMENT_RPC` | HTTPS archive RPC |
| `SETTLEMENT_DATABASE_URL` | Persistent PostgreSQL database |
| `SETTLEMENT_APPROVED_MANIFEST` | Exact reviewed manifest hash |
| `SETTLEMENT_RELAYER_KEY` | Dedicated gas-paying signer, only for `run` |
| `SETTLEMENT_MAX_GAS_PRICE_WEI` | Per-gas price cap |
| `SETTLEMENT_MAX_GAS_PER_PAYMENT` | Per-transaction gas limit cap |
| `SETTLEMENT_TOTAL_GAS_BUDGET_WEI` | Conservative total maximum gas cost for this manifest |

Choose gas caps from current estimates; no unlimited default is provided.

```sh
npm run settlement -- init-db
npm run settlement -- status /private/new-settlement-directory/bundle.json DEPLOYMENT_HASH
npm run settlement -- run /private/new-settlement-directory/bundle.json DEPLOYMENT_HASH --watch
```

`init-db` adds only `settlement_manifests` and `settlement_transactions`. It does not alter colony tables. Use a dedicated database role and persistent storage with fsync enabled. `run` forces synchronous commits before saving signed bytes. Database and bundle backups are required for continuity. Restrict access to signed raw transactions; the signing key is never stored in these tables.

Each step locks the signer and season, checks the immutable on-chain manifest, reserve, anchors and prior receipts, estimates gas, signs one exact payment and persists its raw bytes/hash/nonce **before broadcast**. Unknown outcomes remain pending; retries rebroadcast the same bytes. No automatic nonce replacement or fee bump is used. Twenty confirmations are required for funding and payouts. A nonce consumed without a known receipt or a changed confirmed block stops the executor for review.

Preflight-blocked recipients are skipped so other recipients can be paid. A confirmed revert remains reserved, and other payments continue. To explicitly retry a confirmed reverted index after addressing the cause, set `SETTLEMENT_RETRY_INDEX` for that run. Successful payments never become eligible again. `--watch` exits on completion or when the remaining recipients require review. There is no new payment merely because a request timed out.

The registry prevents using a second manifest/distributor in the same database for the same season. Keep one authoritative database; do not reset, delete or fork the journal to retry payments.

## Verification

```sh
npm run test:settlement
npx tsc -p server/settlement
# Point PGHOST/PGPORT/PGUSER/PGDATABASE to LOCAL PostgreSQL ending in _test:
npm run test:settlement:evm
# Optional mainnet state fork; upstream connection allows reads only:
npx tsx scripts/settlement-stock-fork-test.ts
npm run build
```

EVM integration tests use literal loopback Anvil URLs, synthetic token balances and isolated PostgreSQL test schemas. They test exact transfers, early/unauthorized funding, immutable roots, duplicate and invalid proof rejection, blocked/fee tokens, crash recovery, durable write ordering, gas caps, concurrency, unknown nonces, confirmed reverts and reorg detection. A local fork is not an actual payment or a guarantee that issuer restrictions will be unchanged on payout day.

## Activation still required

This code does not itself deposit assets, authorize a key, or start a production service. Before the first real distribution: close/reconcile the season, approve the final evidence/report, verify the Stock Token deposit, sign deployment/approval/funding, and configure the dedicated relayer and persistent journal. Retest real recipient transfer compatibility at that time. Buyback, fee measurement, swaps and subsequent seasons are outside this operator-funded Season I payout tool.
