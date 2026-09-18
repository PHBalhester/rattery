# RATTERY launch handoff

## Verified public configuration
See rattery-mainnet.json. Chain4663; token0xc322305e79337300b59ff48389f8c9a1d9e0de76; birth block65848849. The same contract was validated with eight successful EVM/database fork groups. No mainnet transaction was sent.

Frontend market settings (server environment, not browser secrets):
- RATTERY_CA: token from manifest
- RATTERY_BIRTH_BLOCK:65848849
- RATTERY_RPC:https://rpc.mainnet.chain.robinhood.com/rpc

Worker market settings:
- RATTERY_MARKET_TOKEN: token from manifest
- RATTERY_MARKET_BIRTH_BLOCK:65848849
- RATTERY_MARKET_START_BLOCK: choose explicitly for the intended NEW ledger, at or after birth. Reusing a populated ledger configured for ZZZ is prohibited; configuration mismatch is intentionally rejected.

The manifest is documentation, not automatically consumed configuration. Existing staging still uses its existing market/world until a reviewed migration or separately provisioned run is deployed. Do not reset or delete the staging colony to switch tokens. Archive and verify restoration first. An RPC429 was observed during bounded read tests; sustained public capacity is not proven.

## Deployment boundary
Current worker, observer, SIWE and persistence adapters have staging-specific guards. Do not remove guards blindly or relabel staging as a production-ready financial service. Decide whether to publish a clearly labeled read-only beta or implement and validate separate production adapters/databases. Do not copy root .vercel configuration into the staging deployment folder.

## Financial boundary
RATTERY supports native burn(uint256), verified on a local fork. Existing payment verification expects this burn; an ordinary transfer to an arbitrary dead address does not satisfy it. Fork tests cover receipt reuse, wrong wallet/amount/token/network/time, confirmations, chain rollback, concurrent reservations, failed database finalization and retry, ownership and cooldowns. These tests are not a hosted-wallet acceptance test. Public payments remain disabled.

## Essential remaining release gates
- Automated offsite backup plus restoration; startup/restart and rollback of the intended public deployment.
- Review all new/modified files before committing; the existing index publication scan passed, not a scan of all untracked files.
- End-to-end public shared-world configuration, bounded load/abuse checks and alerts; RPC/quote availability monitoring.
- Actual financial API/UI, mainnet authentication and reconciliation if paid care is included. Not enabled by token configuration.
- Residence/badge features remain specified only;100 USD threshold approved, valuation/reset policy not finalized.

## Reusable local validation
Set RATTERY_FORK_TOKEN to manifest token and run scripts/mainnet-fork-test.ts with an isolated database ending in _test and verified Anvil binary. For market-live-test.ts set RATTERY_CAPTURE_TOKEN, RATTERY_CAPTURE_BIRTH_BLOCK and RATTERY_CAPTURE_BLOCK to a known trade block. The public-RPC test serializes calls with1500ms intervals and caps80 calls. Never point local EVM write tests or test database operations at public services.
