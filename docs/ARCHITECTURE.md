# Architecture

## Shared production colony

Production runs one authoritative simulation on a server. The browser observes confirmed snapshots and interpolates presentation; it does not advance the shared biology.

```text
On-chain trades -> Market collector -> Ordered trade ledger
                                            |
                                     Simulation worker
                                            |
                                        PostgreSQL
                                            |
                                     Read-only observer
                                            |
                                     Vercel API proxy
                                            |
                                  React / Zustand / Three.js
```

The worker persists the world, random-number state, simulation clock and engine version. The observer omits private care/account state. Clients reject older observations and show delayed-connection status when data becomes stale.

## Local demonstration

Plain Vite runs the local demonstration through src/store.ts. Its simulated balances and local actions do not authorize production care. Local replay and snapshot tools remain useful for controlled tests; they are not the production authority.

## Determinism and replay

Reproduction requires the same engine, configuration, initial world/RNG, ordered market inputs and any operator interventions. Snapshot integrity checks are not proof of authorship. Use trusted archives and record engine transitions.

Production market valuation uses recorded historical quotations. The local demonstration has a fixed reference. Preserve canonical ordering, deduplication and chain validation; arrival order is not a substitute.

## Wallet and care

Wallet -> same-origin authentication/payment proxy -> dedicated payment service -> PostgreSQL.
Each paid action has a reservation and a separately confirmed native token burn. The service verifies its receipt and records application at most once. Signing in is not a token approval. Mint assigns project ownership, not an NFT.

Rendering, browser balances and connected addresses are never authorization. Credentials remain in service configuration.

## Rendering and navigation

Three.js displays articulated rats and habitat assets with procedural fallbacks. Navigation and body separation belong to the simulation; interpolation, gait and secondary motion belong to presentation. Tail collision is approximate.

[Operations](OPERATIONS.md) · [Testing](TESTING.md) · [Wallet](WALLET.md)
