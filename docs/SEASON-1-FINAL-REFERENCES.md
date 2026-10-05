# Season I final reference review — October 5, 2026

Regular-session historical **Close** prices (USD per underlying share), excluding
after-hours and dividend reinvestment. Both providers agree on the six values.
The historical tables list no split or dividend event inside the comparison
window; the Robinhood Stock Token multipliers at the two Friday close anchors
also remained unchanged. Intraday oracle observations were not substituted.

| Company | Sep 25 close | Oct 2 close | Weekly point adjustment |
| --- | ---: | ---: | ---: |
| NVDA | 225.07 | 233.95 | +39 |
| AAPL | 341.07 | 333.69 | -22 |
| AMZN | 249.67 | 251.52 | +7 |

Sources for each pair:

- NVDA: https://stockanalysis.com/stocks/nvda/history/ and https://chartexchange.com/symbol/nasdaq-nvda/historical/
- AAPL: https://stockanalysis.com/stocks/aapl/history/ and https://chartexchange.com/symbol/nasdaq-aapl/historical/
- AMZN: https://stockanalysis.com/stocks/amzn/history/ and https://chartexchange.com/symbol/nasdaq-amzn/historical/

Stock Analysis identifies its historical-data provider as S&P Global Market
Intelligence. Values come from the dated historical rows, not the separate
latest-trade banners on those pages. The exact reviewed inputs are published
in `api/_lib/seasonClosingReferences.ts` and returned with the final result.

## Missing-checkpoint recovery

Slot 877 had an original recorded observation and was confirmed after gas was
replenished. Slots 878–930 were absent, so no measured stress value was invented.
The owner explicitly authorized their audited recovery and onchain confirmation.

The resident ledger proves that only the six permanent-core residents were
alive during the missing interval. The last non-core death was at simulation
day 12947.59241902248, well before the conservative recovery interval
13878–14400. All core residents had wellbeing state. There were no care writes
or intervening operator mutations in the affected period.

The deployed v25 engine ends every tick by clamping each permanent-core
resident's acute and chronic stress to at most 0.2. Thus their weighted mean is
below the happy threshold of 0.3 throughout the interval. US regular trading
was closed. The published rule therefore uniquely determines **+1 point per
nest per slot**, independent of the unknown exact stress values.

The proof is `season1-checkpoint-recovery-20261005.json` (SHA-256
`4a243b18f7ff5812998b251eef222af6ca71328b5fc823478fe09673745efefb`). A transaction
preserved the prior checkpoint records in `season_checkpoint_recoveries` and
inserted only the 53 missing rows. Their observations explicitly state
`stressMeasured=false` and identify the classification proof. Existing points,
identities, ownership and payment records were not rewritten. The ordinary
worker signs the sequential updates with the dedicated scoring wallet.

An auxiliary offline replay matched 50 saved observations before being stopped;
it is not presented as a completed full-world replay. The recovery rests on the
classification invariant and complete resident interval evidence above.
