# RATTERY token

> Status update - September 23, 2026: production mint and paid care are live. A read-only check verified 28 applied mints and their burns, ownership and events. Statements below about disabled payments or an untested first mint describe earlier validation stages. See [current validation](../README.md#validation-and-limitations) and [operations](OPERATIONS.md).

User-provided final contract: 0xC322305e79337300b59fF48389f8C9A1D9E0de76
Launch page: https://www.ponsfamily.com/launchpad/0xC322305e79337300b59fF48389f8C9A1D9E0de76

Read-only RPC verification on Robinhood Chain mainnet (chain ID 4663):
- Name: rattery experiment
- Symbol: RATTERY
- Decimals: 18
- Total supply at verification: 1,000,000,000 tokens
- Contract code: 3248 bytes
- Block: 65849741
- Verified at: 2026-09-18T01:58:00.819Z

This verifies deployed code and ERC-20 metadata, not contract provenance, burn semantics, permissions or financial-flow readiness. The launch page was not accessible through the web tool. Payment execution remains disabled. No transaction or wallet signature was performed. The existing staging collector token and existing colony were not changed. Next: verify contract source/transfer behavior and test the final token in a local fork before configuring financial execution.

## Final-token validation
The canonical Pons factory launch event was found at block 65848849, transaction 0x33364fdc7be1d4741ee0defa2e7cae5230be9aea0f7ace1741aed14940ebb7d0, curve 0x0f5d652f31b1221db5cd71f8b0fe4b9bf3b4736b. Public configuration is recorded in deploy/rattery-mainnet.json; it is not an automatic deployment or payment activation.

All eight local-fork groups passed for RATTERY at block 65855001 (hash 0x2dc02dc5d990f37076b0ecce0e034c8d6caeb7db5debc1538f21394e575aa2c8). Bytecode hash 0xf84e8cd3e698c99e3593a1a0e4d63d4081cf5536473a022266623d4ba55f06f0. Native burn reduces balance and totalSupply exactly; ordinary transfers are rejected as payment. Wrong amount/wallet/token/network/time, confirmations, chain rollback, duplicate receipt, competing mint requests, database failure recovery and care ownership/cooldown passed. 79 upstream reads, zero mainnet transactions. Synthetic funds on loopback chain46630; this is not a public financial deployment.

Reproduce with RATTERY_FORK_TOKEN set to this token, RATTERY_ANVIL pointing to the verified local binary and a PostgreSQL database ending in _test. Existing ZZZ default remains a regression fixture. Essential care/burn tests,36 trade-rule cases,API/server typechecks and exclusion of the financial lab from the public build also passed.
