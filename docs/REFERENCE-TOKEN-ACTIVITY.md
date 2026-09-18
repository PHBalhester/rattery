# Reference token activity

User-selected Pons token:0x30C8562dBb63B3FfD3a4230Dc5B370dE7E257F50 (Chainstation).
Snapshot UTC:2026-09-18T02:40:29.398694+00:00
Source:https://api.dexscreener.com/latest/dex/tokens/0x30C8562dBb63B3FfD3a4230Dc5B370dE7E257F50
Observed pool:0xe136fcb0172f3931008087c39477f75e33c056bb2fa2a887253074f2385fa2aa
Rolling windows at capture:5min0buy/0sell;1h5buy/1sell;6h10buy/3sell;24h21buy/34sell. Volume24h USD2132.52. These are pair-indexer aggregates, not validated comprehensive Pons history. No launch-peak count was obtained. Both private Alchemy and public RPC returned429; avoid further retries until capacity is resolved.

Optimized empty-range model:210 CU per poll, at most518400 polls over30days at5second spacing ignoring processing time =108.864M CU, USD57.1536 at USD0.525/M CU. Excludes startup, retries, multiple collectors, financial reads and other services. At55curve/pool events per day, incremental block/transaction checks are small relative to constant polling, assuming no omitted venues. This is a workload illustration, not a measured monthly invoice. A hypothetical15second interval lowers the empty-poll baseline to USD19.0512 but is NOT implemented and must preserve catch-up capacity. Launch burst remains unmeasured.
