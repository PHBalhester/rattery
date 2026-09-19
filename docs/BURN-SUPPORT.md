# Confirmed burns support the colony

Supply burned already equals the original 1 billion tokens minus on-chain totalSupply. Genuine burns anywhere therefore already count. Sending tokens to a dead wallet does not reduce totalSupply and is not counted.

From activation onward, the existing collector also scans RATTERY ERC20 Transfer events whose recipient is the zero address. It uses the same 20-confirmation depth, canonical block checks and halt-on-reorganization safeguards as trades. No new wallet permission, payment or user submission is needed. Historical burns remain in the supply statistic but are not replayed as new care.

Every confirmed burn receives one collective support evaluation, including burns made for website care. This is an additional collective benefit; it never replaces or duplicates the purchased individual action. Deduplication uses chain, token, transaction hash and log index. The ledger and world update commit together, so retries, restarts and duplicate RPC responses cannot repeat the benefit. No ETH/USD quote is required.

10,000 RATTERY funds up to 0.15 normalized recovery points. The most depleted needs are treated first: colony food/water/warmth/calm and living residents’ energy/hydration/acute stress. Target levels are 95% food/water, 65% warmth, 10% environmental stress, 90% energy/hydration and 20% acute stress. These are support targets, not guaranteed health or protection.

A shared bucket allows at most 3 points immediately and replenishes 3 per real hour. Splitting a burn cannot bypass this budget. Excess or unnecessary support is not banked or refunded. Burns never resurrect rats, change ownership, activate protection or erase history. Biological rules and purchased care continue normally.

Audit: colony_burns records the verified event, application tick/time and actual resources delivered. Public world.burnSupport exposes cumulative observed units/events and the latest support summary; it is not added to the totalSupply-derived statistic.

Operator rollout: apply migration 012, grant worker SELECT/INSERT/UPDATE on colony_burns, archive engine state and transition to v19, then deploy compatible worker/payments/observer builds. Preserve the market cursor; do not backfill rewards by rewinding it.
