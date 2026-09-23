# Stock seasons — design status

This document records the discussed direction. Stock seasons are planned and are not the current production game. No dates or payouts are promised by this document.

## Design direction

| Element | Discussed rule | Status |
| --- | --- | --- |
| Teams | Three nests and three couples representing selected stock tickers | Planned |
| Contributions | Feeding with RATTERY produces litter points | Planned |
| Stock influence | Bounded adjustment applied once, when points are produced | Planned |
| Attacks | Affect rival season points rather than killing rats | Planned |
| Shields | Protect against attacks under defined limits | Planned |
| Colony condition | Calm supports activity; stress may reduce season points across nests | Planned; coefficients pending |
| Settlement | One winning nest after the weekly Sunday cutoff | Planned; timezone/cutoff pending |
| Prize pool | Opening pot plus the week's eligible fees | Planned; funding specification pending |
| Rewards | Tokenized-stock rewards, with contribution weighting and a holding component | Planned; eligibility and allocation pending |
| Continuity | Rats persist beyond the season | Planned; permanent survival rules required |

## Decisions required before implementation

- Ticker selection, reference prices, market hours, holidays, splits, missing quotes and stale data.
- Production formula, adjustment cap, rounding and event timestamps.
- Attack costs, limits, shield duration and tie-breaking.
- Preventing stock influence from being counted again through stress or settlement.
- Exact fee allocation, opening funding, reward asset custody and delivery.
- Contribution weighting, holding snapshots, eligibility and duplicate-account incentives.
- Treatment of late actions, interrupted processing, refunds where applicable and disputes.
- How the existing residents participate alongside the three couples.

Earlier discussion included percentage-based funding ideas. They are not fixed here because the later description used opening pot plus weekly fees without final allocation parameters.

## Verification requirements

Publish the rules before accepting season contributions. Keep scoring and distribution reproducible from recorded events. Animation or learned behavior must not improvise rewards. Test boundaries, missing prices, replay, duplicate events and settlement recovery.

Current temporary protection is not the permanent survival guarantee proposed for this mode.

[Roadmap](ROADMAP.md) · [Operations](OPERATIONS.md)
