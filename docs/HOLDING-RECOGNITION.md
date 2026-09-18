# Holding recognition

## Rules approved for launch

Recognition is cosmetic: no yield, payments, discounts, priority, voting power or biological advantage. No token lock or extra burn is required to participate.

**Residence:** maintain at least US$100 worth of RATTERY at the updated verified reference price. Milestones are 7, 30 and 90 verified real days. Buying a large balance today does not grant prior time. Monitoring begins after authenticated participation; no unverified pre-enrollment history is credited.

**Caregiver identity:** an understated diamond beside the name of a minted rat identifies its verified caregiver. Residence milestones add 7d, 30d or 90d. A badge never grants ownership: mint ownership and authorization remain authoritative. Caregiver identity remains in the memorial. Milestone/reset evidence is retained privately in the database; public views expose badges, not wallet addresses.

## Current price and resets

The approved threshold is US$100 at the updated price, not a token quantity fixed at enrollment. A verified value below US$100 resets accumulated time, whether caused by selling, transferring, burning tokens or a price decline. Returning above the threshold starts at zero.

The worker checks approximately once per minute, with 20-block confirmation depth. It uses Pons curve pricing reserves from getReserves() and the previous completed ETH/USD minute candle from Coinbase. Integer arithmetic records the balance, reserves, USD value, block hash and price-source evidence. This spot valuation is a recognition reference, not guaranteed sale proceeds; fees and slippage are not deducted.

Between consecutive timely checks, token Transfer logs reconstruct balance movements. A drop below the threshold followed by a repurchase does not preserve the prior streak. The endpoint price is used to value intermediate token balances. This is periodic verification, not a claim that every intraminute market-price movement has been measured.

## Missing data and boundaries

RPC failures, inconsistent balance history, stale quotes or an unavailable price pause verification. Unverified gaps over two minutes add no time. Existing verified time is retained while pending, and active residence badges are withheld until verification resumes. Disconnecting the wallet does not stop server-side monitoring once enrolled.

The initial price adapter supports the current Pons bonding curve. After graduation it fails closed and shows pending until the Uniswap v4 price adapter is validated. It never continues using obsolete curve reserves. Monitoring is bounded to 100 wallets per pass, oldest checked first; overload pauses unverified time rather than inventing it. Scale the worker before this bound becomes material.

## Storage and implementation

Migration 011 creates holder_residence and holder_residence_history. Runtime worker permissions are restricted; its enrollment view exposes only wallet addresses, not auth session digests. Observers receive no wallet map. Neither a badge nor a browser request can authorize a paid action.

References: https://docs.ponsfamily.com/v2 (pricing reserves and graduation); https://docs.cdp.coinbase.com/exchange/reference/exchangerestapi_getproductcandles (ETH/USD candles).

## Roadmap

Additional social recognition, collectibles, shared spaces and other previously proposed incentives remain roadmap items, not launch promises. The post-graduation quote adapter, more granular price history and larger monitoring batches need separate validation.
