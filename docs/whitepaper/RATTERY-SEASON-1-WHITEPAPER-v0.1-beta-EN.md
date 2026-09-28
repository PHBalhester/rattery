# RATTERY Season 1 Whitepaper

Version 0.1 | September 26, 2026

## Overview

RATTERY Season 1 brings weekly competition to an on-chain rat colony on Robinhood Chain. Participants choose a nest representing NVIDIA, Apple or Amazon, burn RATTERY to perform actions, and compete for prizes paid in the winning company's Robinhood Stock Token. Eligible holders share a separate reward allocation without needing to win a nest competition.

Gameplay combines player actions, the condition of the colony and movements in the three underlying stocks. A happy colony generates points, a stressed colony removes points, and each company's stock direction changes that recurring effect. A separate weekly stock adjustment is applied before the winner is selected.

Season 1 has a committed opening prize contribution of 1,000 USDC, supplemented by 70% of eligible weekly fee receipts. This describes the approved design and planned automation. The opening contribution is not represented as a verified deposit, and the gameplay, pricing and automated settlement integrations must be completed before paid participation opens. The launch date will be announced separately.

## The weekly competition

Three nests represent NVIDIA, Apple and Amazon. Each nest has a resident couple. Players can feed their nest, protect it with a shield or attack a rival nest. These actions affect competition points; snake attacks and cosmetic point losses do not kill resident rats. Existing permanent residents retain their identities and protection.

Each wallet may have one active nest membership. This is a wallet-level rule, not a guarantee that each wallet represents a different person.

All times below use America/Sao_Paulo, the time zone for Sao Paulo, Brazil.

| Event | Weekly schedule |
| --- | --- |
| Competition opens | Monday at 13:00 |
| Nest switching closes | Sunday at 19:00 |
| Gameplay closes | Monday at 00:00, the midnight following Sunday |
| Result and payments | Planned for Monday morning after reconciliation |
| Next competition opens | Monday at 13:00 |
| Fee measurement window | Monday 00:00 inclusive to the next Monday 00:00 exclusive |

First-time entrants may join until gameplay closes. The five-hour switching restriction applies to wallets changing nests. Payment timing depends on successful reconciliation, pricing and transaction execution; a delay does not reopen the closed competition.

## Entry and paid actions

Action prices are fixed in USD. The amount of RATTERY burned is quoted from its current pool price converted into USD. A quote remains valid for 60 seconds and shows the exact token amount before confirmation. Unavailable or stale price data suspends new quotes.

| Entry time remaining | Entry price | Initial points and contribution units |
| --- | --- | --- |
| More than 72 hours | USD 10 | 100 |
| 72 to 36 hours | USD 15 | 100 |
| 36 to 12 hours | USD 20 | 100 |
| Final 12 hours | USD 30 | 100 |

A valid entry quote retains its quoted price across an entry-price increase until the quote expires. It does not extend the season cutoff or the switching deadline. The late-entry premium does not buy additional points or reward weight.

| Action | Price in RATTERY equivalent | Effect |
| --- | --- | --- |
| Extra feeding | USD 2 | Adds 20 nest points and 20 contribution units |
| Shield | USD 10 | Blocks one complete attack against the nest |
| Attack | USD 20 | Removes points from one rival nest |

All entry, feeding, shield and attack payments burn RATTERY. Burned tokens are not prize funds. Conditions must be validated before the burn in the same atomic execution path. Rejected or expired actions must not burn RATTERY, although a failed transaction may still incur a network fee.

Changing nests requires paying the current entry price again and creates a new membership with its own initial contribution. Points already produced remain with the previous nest, while the departing wallet forfeits that membership's reward rights. Returning later does not restore those rights.

## Shields and attacks

A shield protects the entire nest against one attack. It expires 15 minutes after activation unless consumed earlier. Only one shield may be active; shields cannot be stacked or extended. The nest shares a 30-minute activation cooldown measured from its last activation, even if the shield is consumed early. Shields provide no points or reward contribution units.

An unshielded attack removes 10% of the target's current score, rounded down to whole points, capped at 500 points per attack. A target with 237 points loses 23; a target below 10 points loses zero. Removed points are not transferred to the attacker. Attacks provide no contribution units.

Each attacking nest shares a 60-minute cooldown, including after an attack blocked by a shield. Different wallets or targets cannot bypass it. An attack resolves in blockchain order; a shield executed afterwards cannot reverse its damage. Both rival nests can independently attack the same target.

Attacks reduce the nest score, not contribution units already earned by its eligible members. If that nest wins, those preserved contributions still determine its active reward allocation.

## Colony condition and recurring stock effects

The recurring effect has a base magnitude of 1 point per 10 minutes. Each nest uses the direction of its own company's stock, measured against the previous regular-session close. Outside the regular trading session, the stock modifier is neutral.

| Colony condition | Stock above previous close | Stock unchanged or market closed | Stock below previous close |
| --- | --- | --- | --- |
| Happy | +2 points | +1 point | +0.5 points |
| Neutral | 0 points | 0 points | 0 points |
| Stressed | -0.5 points | -1 point | -2 points |

This mechanism runs alongside player actions and the weekly stock adjustment. The same colony condition can therefore produce different point changes across the three nests.

Colony condition uses average stress across living rats: below 30% is happy; from 30% inclusive to below 45% is neutral; 45% or higher is stressed. A neutral colony produces no recurring point change. Cosmetic point representations are excluded from the living-rat average.

**Configuration before opening.** The launch rules must specify the authoritative ten-minute observations, fractional-point accounting, unavailable intraday prices and event ordering against player actions. These operational settings are not presented here as implemented or tested.

## Weekly stock adjustment

At settlement, each nest receives an additional adjustment based on its company's weekly stock return:

`Weekly return (%) = 100 × (ending reference close / starting reference close − 1)`

`Weekly point adjustment = weekly return (%) × 10`

A 2% rise adds 20 points; a 2% fall deducts 20. The adjustment is applied once, in addition to recurring colony effects, and is not multiplied by the nest's score, number of participants or reward bonuses.

Reference prices are regular-session closes from the Friday before the competition week and the Friday within it. If either Friday has no session, use the last trading session on or before that Friday. Both prices are adjusted consistently for splits and reverse splits. After-hours trading and dividends are excluded from this return calculation.

Round the adjustment once to the nearest integer, with exact halves rounded away from zero. Final settlement scores cannot be negative. There is no nest-score ceiling and no cap on the weekly stock adjustment. Missing required observations delay the result; they do not justify inventing a zero return.

## Selecting the winner

The highest final score wins. Ties are resolved by the greatest gross points generated through entries and extra feeding, then by which nest reached that production total first in blockchain transaction order. Attacks do not erase gross production, and abandoned membership production remains with its original nest.

If tied nests have no such production, use the published rotating priority: NVIDIA, Apple, Amazon in Season 1; Apple, Amazon, NVIDIA in Season 2; Amazon, NVIDIA, Apple in Season 3, repeating thereafter. Select the first tied nest in that season's order.

## Prize funding and fee allocation

Eligible fees are ETH fee receipts actually received by the project during the weekly measurement window. Late receipts belong to their receipt week. Initial contributions and internal transfers are not additional fee revenue.

| Weekly fee allocation | Share |
| --- | --- |
| Prizes | 70% |
| RATTERY buyback and burn | 15% |
| Infrastructure, team and marketing | 15% |

The initial 1,000 USDC goes entirely into Season 1 prizes. It is not subject to the weekly fee allocation.

Fresh Season 1 prize funding consists of that contribution plus the 70% prize allocation from weekly ETH fees. Displayed USD equivalents of ETH are estimates until conversion; they are not additional received funds.

Fresh prize funding is divided 80% for eligible active participants of the winning nest and 20% for eligible passive holders. Both groups receive the winning company's Stock Token. The initial contribution therefore assigns 800 USDC equivalent to active rewards and 200 USDC equivalent to passive rewards before acquisition. Operational funds cover conversion and distribution costs.

## Active participant rewards

An eligible winning membership receives a proportional share of the active pool according to its contribution units and historical bonuses:

`Active weight = eligible membership contribution × (1 + holder bonus + burner bonus)`

`Individual active reward = active pool × individual weight / total eligible winning weight`

Only entries and extra feeding produce contribution units. Shield and attack spending does not. Recurring colony effects and stock settlement adjustments affect nest scores, not purchased contribution units. A losing membership receives no active prize, although its wallet may separately qualify for passive rewards.

There is no per-wallet payout cap or diminishing contribution curve. Large contributions may produce concentrated rewards. A wallet may qualify for both active and passive rewards.

## Holder rewards and holding history

Passive rewards use each eligible wallet's time-weighted average direct RATTERY balance from Monday 13:00 to the following Monday 00:00. Holding tokens for only part of that interval contributes only for that time. The measurement is not an average of two snapshots.

The minimum qualifying average is USD 25 reference equivalent, converted into a fixed RATTERY threshold using the average USD price over the five minutes immediately before Season 1 opens. The full qualifying average balance determines passive reward weight, not merely the amount above the threshold.

The separate active holding-history bonus requires continuous holding above a USD 100 reference threshold, converted using the same five-minute reference.

| Continuous qualifying holding at season opening | Active weight bonus |
| --- | --- |
| At least 7 days | +2% |
| At least 14 days | +3% |
| At least 30 days | +5% |

Only the highest tier applies. The bonus is evaluated at season opening and remains fixed for that season, including for later entrants. A higher tier reached midweek does not increase the current bonus. Selling afterwards does not revise that season's fixed active bonus, but does affect the passive balance average and later holding eligibility.

The two token thresholds are published and fixed throughout Season 1. Liquidity-pool positions do not count. Identified team and treasury wallets are excluded from prizes. Historical bonuses do not multiply passive reward weights.

## Historical burner rewards

A wallet qualifies for the historical burner program by accumulating at least 1,000,000 RATTERY in verified burns before Season 1 opens. Burns are summed for the same wallet; burns after that cutoff do not establish historical qualification.

Eligible wallets start with a +5% active reward-weight bonus. Each completed qualifying season adds one percentage point for the following season, capped at +15%. A qualifying season requires paid entry and at least five accepted extra feeding actions. Entry-included feeding does not count toward the five.

Extra feeds are counted across that wallet's memberships, including memberships abandoned by switching. Winning is not required. Qualifying weeks need not be consecutive, and each wallet can earn at most one progression credit per season. More historical burn volume does not add another bonus.

Holding and burner bonuses are additive, with a combined maximum of +20% active reward weight. These bonuses do not increase nest points, attack damage or passive reward weight.

## Automated acquisition distribution and buyback

A new execution wallet will receive the initial prize contribution and 85% of weekly fees: 70% reserved for prizes and 15% reserved for buyback and burn. Separate accounting preserves both purposes even though custody is shared.

After reconciliation and winner selection, the system will acquire the corresponding Stock Token and distribute the quantity actually acquired under the approved active and passive allocation rules. The same wallet will separately buy RATTERY using the buyback reserve and burn it after each confirmed purchase.

Maximum swap slippage is 1% for Stock Token acquisition and 3% for RATTERY acquisition. The automation will not raise those limits to force execution. It may obtain a new quote, wait or split purchases while respecting the reserve budget. No additional numerical price-impact cap is imposed. Slippage limits constrain deterioration from a quote, not price impact already embedded in that quote.

Buyback is planned for Monday after fee reconciliation and can proceed independently of prize distribution. Each swap, payout and confirmed burn will have a public transaction reference. The automation must reconcile uncertain transaction outcomes before retrying so that timeouts cannot cause duplicate payments or purchases.

## Rollover and interrupted payments

If the winning nest has no eligible active participants, its active pool carries into the next season's active pool. If no passive holders qualify, the passive pool carries into the next passive pool. Repeated rollover retains its original category and is not split again as fresh funding.

Rounding remainders remain in their original category for the next season. A failed individual payout remains reserved for its recipient rather than becoming general carryover. Failed buybacks preserve the buyback reserve. Public status will identify delays without reopening gameplay or changing the closed competition's rules.

## Reward assets and launch disclosures

The reward asset depends on the winning nest. The following contracts were verified against the Robinhood asset registry on September 26, 2026, on Robinhood Chain, chain ID 4663:

- NVIDIA NVDA: `0xd0601CE157Db5bdC3162BbaC2a2C8aF5320D9EEC`
- Apple AAPL: `0xaF3D76f1834A1d425780943C99Ea8A608f8a93f9`
- Amazon AMZN: `0x12f190a9F9d7D37a250758b26824B97CE941bF54`

These are Robinhood Stock Tokens providing economic exposure to the underlying companies, not direct ownership of the underlying shares. Recipient eligibility and distribution must meet the issuer's applicable conditions. Token identity alone does not establish an available acquisition or distribution route.

Before opening paid participation, RATTERY will publish the launch timestamp, execution and fee-source addresses, exclusion list, price references, fixed holding thresholds and operational settlement rules. The operational details for colony-state scoring must also be finalized. Asset availability, historical records, funding and end-to-end automation must be verified before launch. Previously completed tests of the earlier rules do not validate the newly added colony scoring mechanism.

## Official references

- RATTERY website: https://rattery.tech
- RATTERY account: https://x.com/ratterytech
- Robinhood asset registry: https://api.robinhood.com/rhj/assets
- Stock Token documentation: https://docs.robinhood.com/chain/stock-tokens/
- Issuer product information: https://robinhood.com/rhj/stocktokens/
