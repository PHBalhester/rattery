import type {ClosingReferences} from './seasonResult.js';
// Reviewed regular-session historical CLOSE column, not intraday/after-hours quotes.
// Sep 25 and Oct 2, 2026: cross-checked between S&P Global via Stock Analysis and
// ChartExchange. No split/dividend event in this interval; same per-share scale.
export const closingReferences:ClosingReferences={
  "method": "regular-session-close-split-adjusted-no-dividends",
  "reviewedAt": "2026-10-05T11:22:58.992910+00:00",
  "rows": [
    {
      "ticker": "NVDA",
      "startDate": "2026-09-25",
      "endDate": "2026-10-02",
      "start": "22507",
      "end": "23395",
      "decimals": 2,
      "sources": [
        "https://stockanalysis.com/stocks/nvda/history/",
        "https://chartexchange.com/symbol/nasdaq-nvda/historical/"
      ]
    },
    {
      "ticker": "AAPL",
      "startDate": "2026-09-25",
      "endDate": "2026-10-02",
      "start": "34107",
      "end": "33369",
      "decimals": 2,
      "sources": [
        "https://stockanalysis.com/stocks/aapl/history/",
        "https://chartexchange.com/symbol/nasdaq-aapl/historical/"
      ]
    },
    {
      "ticker": "AMZN",
      "startDate": "2026-09-25",
      "endDate": "2026-10-02",
      "start": "24967",
      "end": "25152",
      "decimals": 2,
      "sources": [
        "https://stockanalysis.com/stocks/amzn/history/",
        "https://chartexchange.com/symbol/nasdaq-amzn/historical/"
      ]
    }
  ]
};
