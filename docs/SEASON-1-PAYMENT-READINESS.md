# Season I payment readiness — 2026-10-05

- Result: AMZN; all 930 checkpoints confirmed.
- Approved allocation: USD 1,000 players + USD 300 holders, token ratio 10:3.
- Recipients: 133 unique wallets. Overlapping player/holder allocations merge into one payment.
- Full finalized collector was rerun at its original anchor with the reviewed settlement references. All evidence matched the final ranking snapshot (only the reference hash was rebound to the complete reference document).
- The production rewards function reproduced every published per-wallet USD allocation exactly using 1,300,000,000 micro-USD as its test unit supply.
- Local PostgreSQL + Anvil tests passed: immutable funding, altered proof/duplicate rejection, interruption recovery, persisted transactions before broadcast, reorg detection, gas limits and idempotent completion. Tests use synthetic balances; no production payment was sent.
- Treasury checked 2026-10-05 09:29 Sao Paulo: 0 AMZN; 0.000756609566308 ETH. Gas sufficiency has not yet been estimated for the actual final distribution.

Prepared private inputs are in `/home/phbal/Rattery/output/season1-payment-inputs`: references.json, snapshot.json, funding.json, readiness.json. The holder thresholds and closes are fixed historical inputs, never recomputed from payout-day prices.

## Activation pending

1. Receive and confirm the explicitly declared AMZN prize quantity in the treasury. Never sweep unrelated deposits. Token: `0x12f190a9f9d7d37a250758b26824b97ce941bf54`, chain 4663.
2. Prepare a fresh immutable bundle with that quantity and `--funding docs/season1-prize-funding.json`. Recheck recipient transfer compatibility and gas estimates at that time. Do not derive token quantities by rounding the social image's dollar values.
3. Treasury wallet signs deployment, exact approval, and funding. No treasury private key is needed by the service.
4. Configure a separate relayer with ETH, durable PostgreSQL journal and the exact approved manifest/deployment hash. Do not reuse the scoring key. Run the existing `run ... --watch` executor under supervision; terminal failure/reorg conditions need review.
5. Reconcile receipts and each onchain paid flag before reporting payment completion.

No final token manifest, production distributor or production relayer is active yet. Merely depositing tokens does not trigger an unreviewed transfer.
