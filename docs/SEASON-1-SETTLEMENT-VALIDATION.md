# Season I payout validation — October 1, 2026

Implementation checkout: `ui-clarity-review`. No production deployment, actual Stock Token movement or use of the scoring signer occurred during this validation.

## Passed

- `npm run build` (existing Vite chunk-size and mixed import warnings remain).
- `npx tsc -p server/settlement`, including the operator CLI and test scripts.
- `npm run test:settlement`: weekly score rounding and tie rules, exact transfer-based TWAB, contribution forfeiture, holding/burn bonus limits, exclusions, integer dust/rollover conservation, Merkle domain separation, missing evidence, incomplete checkpoints and closing gates.
- `npm run test:settlement:evm`: solc 0.8.24 + local Anvil + isolated PostgreSQL schema in a `_test` database. Funding/duplicate/proof controls, exact token deltas, failed and blocked token transfers, reentrancy, durable-before-broadcast journal, interrupted submissions, confirmation handling, one-manifest registry, concurrency, gas budgets, explicit revert recovery and deep-reorg stops.
- `settlement-operator-browser.cjs`: Microsoft Edge, 1440 px and 390 px, injected mock wallet only. Three signing steps, local server capability/CSP/method restrictions, no horizontal overflow or page errors. This is not a real wallet signature test.

## Actual Stock Token bytecode on a local mainnet-state fork

Read-only upstream: Robinhood public RPC. Every state mutation and synthetic balance injection targeted loopback Anvil, chain 31337.

Frozen upstream block: **77,388,075**.
Block hash: `0x126ef4389f545fe652319e3ac18cca62c5f10bc6121ec3e006c8387875f2a2e4`.

| Asset | Contract | Result |
| --- | --- | --- |
| NVDA | `0xd0601ce157db5bdc3162bbac2a2c8af5320d9eec` | Exact approval, funding and two recipient transfers passed |
| AAPL | `0xaf3d76f1834a1d425780943c99ea8a608f8a93f9` | Exact approval, funding and two recipient transfers passed |
| AMZN | `0x12f190a9f9d7d37a250758b26824b97ce941bf54` | Exact approval, funding and two recipient transfers passed |

The proxy code hash at that block was `0x6c1fdd40002dcb440c7fff6a84171404d279ccb057803b65826f7546acd65630` for all three tokens. This identifies the proxy code tested, not an immutable guarantee about the underlying implementation or future issuer permissions. These tests are reproducible with `scripts/settlement-stock-fork-test.ts` at a newly captured confirmed block.

## Not represented as validated

- The final Oct 2 closing prices or final Oct 5 season outcome (future at test time).
- Approved fixed threshold/exclusion evidence, final funding amount, or real recipient eligibility at payment time.
- Treasury signatures on an actual distributor, a deployed production relayer, its ETH budget, or real payouts.

The operator runbook describes the remaining activation steps. Finalization deliberately refuses an open season or missing evidence.
