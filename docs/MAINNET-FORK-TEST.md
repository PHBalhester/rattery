# Mainnet token fork validation

On 2026-09-16, eight integration groups passed using ZZZ at `0x7dbf38976f6d3b9c529e7d9484a71898b409ee6a`, copied from Robinhood mainnet (4663), block **64650478**.

- Block hash: `0x32013e4d2792cfae1463c448177c8d798dfebf15a6beb384aa2d5c494ff346d7`.
- Bytecode keccak256: `0x3d5ba33c3a94f655c16348011ff2c72f6ce8085239454ce4a6c4bf284e84a597`.
- Anvil 1.8.3 official Linux AMD64 release, archive SHA-256 `7ca48e6ca3cac1bce1403ca67e5bc1dc3bc1fd818199c9957c7165079c228568`.

## Isolation
The node and its upstream read-only proxy bind to loopback. An explicit method allowlist prevents forwarding transactions to the mainnet RPC. The successful run made 80 allowed RPC reads and forwarded zero writes. Unsupported requests were blocked, including an intentional sendRawTransaction rejection test.

The local execution chain ID is overridden to 46630 to exercise the staging-only persistence service without relaxing its network guard. This is **not** a public testnet transaction or an unchanged chain-environment reproduction. Contract bytecode and initial chain storage are copied from mainnet. A fresh ephemeral account receives synthetic ETH and 5,000,000 synthetic tokens by changing only its balance storage on the local copy (slot 0). The global supply is not increased for this artificial funding; tests check the exact subsequent burn deltas. No real holder key or wallet is used.

## Results
1. Local bytecode equals the pinned mainnet bytecode.
2. Real EVM burn reduces wallet balance and total supply by the exact amount; unconfirmed receipt is rejected.
3. Wrong wallet, amount, token, chain and time window are rejected.
4. Normal transfer is rejected as payment; insufficient balance produces a reverted transaction.
5. A receipt removed by local chain rollback is rejected.
6. Real SIWE signature, 12 concurrent reservations, local burn, database failure and 12 concurrent retries result in exactly one mint.
7. The receipt cannot mint a second rat, and another wallet cannot care for the owned rat.
8. Feeding consumes a distinct real local burn, applies once, and enforces its cooldown.

## Reproduce
Install the official Anvil release with checksum verification. Supply an isolated PostgreSQL database ending in `_test` using PGHOST/PGPORT/PGUSER/PGDATABASE and set RATTERY_ANVIL to the local binary path. Run `node --import tsx scripts/mainnet-fork-test.ts`.

The script creates a unique PostgreSQL schema, writes a local ignored report under test-results/mainnet-fork, and stops its local node/proxy on completion. Each run selects and records a new fixed source block. It has an upstream read budget of 1,000 calls and does not run automatically in CI against public infrastructure.

## Limits
This validates the selected token's burn behavior and server-side payment application. It does not validate every Pons token, mainnet broadcasting, public testnet deployment, live trading/slippage, final RATTERY configuration, browser burn submission or the authoritative continuous simulation connection. Real payments remain disabled.

Reference: [official Anvil fork documentation](https://www.getfoundry.sh/anvil/index.html).

A repeat run against block **64654252** also passed all eight groups after final script cleanup.
