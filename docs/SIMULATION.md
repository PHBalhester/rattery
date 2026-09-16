# Simulation rules

Default: two females/two males, cap 80 living rats, 60 real seconds per simulation day and 100 ms ticks. These are configurable simulation rules.

## Trade tiers
Below USD 50, effects stay light with no trade animation. Thresholds at 50, 250, 500 and 1,000 progressively influence curiosity, exploration, wellbeing/stress and eligible social interactions. See README and src/sim/marketMap.ts.

USD uses a fixed reference. A large event does not guarantee courtship or fighting: affinity, needs, adulthood and cooldowns matter. Resources, crowding, injury and rest affect behavior.

## Care: approved design
| Action | Tokens | Cooldown |
| --- | ---: | --- |
| Mint ownership | 500,000 | Once per rat |
| Rename | Included / 0 | 24 hours |
| Feed | 10,000 | 4 hours |
| Water | 10,000 | 2 hours |
| Pet | 5,000 | 1 hour |
| Play | 5,000 | 2 hours |
| Treat | 5,000 | 8 hours |
| Explore | 10,000 | 1 hour |
| Prosocial stimulus | 100,000 | Shared 2 hours |
| Aggression stimulus | 100,000 | Shared 2 hours |
| Observe | Free | Unlimited |

Cooldowns use real time. Names are 1–32 valid characters. Eligibility checks include satiety, receptivity, adulthood and activity. Observation remains public; only the owner may care for an owned rat.

Costs are intended to be burned. Only fictional demo accounts currently execute care. Mint means the project's ownership record, not a deployed ERC-721 contract.

The care reducer checks sequence, amount, ownership, timestamps and cooldowns but assumes an authenticated authoritative caller. Direct client invocation is not secure payment processing.

## Limitations
Welfare meters are simulation indices, not clinical measures. Death/extinction are possible states. Memorial/genealogy data require a durable retention policy before indefinite operation. Do not present biological simulation outcomes as financial guarantees.
