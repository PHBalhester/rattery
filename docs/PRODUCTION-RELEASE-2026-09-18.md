# Production release — 2026-09-18

- Public URL: https://rattery.tech ; www redirects to the canonical root.
- Cloudflare DNS-only A records: 216.198.79.1 and 64.29.17.1, as recommended by Vercel. Mail and staging records preserved.
- Production frontend bundle: index-HQK07THA.js.
- Separate production database and least-privilege service roles; physical PostgreSQL cluster remains shared with staging.
- Vercel proxies authenticated requests to a private-credential Railway payment service. No public database port was introduced.
- Mainnet chain 4663, final RATTERY contract 0xc322305e79337300b59ff48389f8c9a1d9e0de76. Native burn, minimum 20 confirmations. Mint is database ownership, not an NFT.
- Public HTTPS, observer and anonymous auth session checked successfully. Observer snapshot age approximately 3 seconds. www redirect checked.
- Browser integration test passed: signed login, reservation, exact simulated burn, reload, background recovery, single receipt and ownership. No real tokens burned by this test.

## Fresh production round

At the user’s request, a fresh round replaced the extinct test simulation on 2026-09-18. Run ID: rattery-production-launch-20260918. Four adult founders: Emma, Mei, Oliver and Wei. Verified publicly: zero deaths, empty memorial, fresh snapshot and active market collector.

All 1532 prior rat records, world state and engine history were archived in a restricted database schema, with a separate custom-format database backup retained on the database server. No payment intents, receipts or ownership existed at replacement; this was asserted inside the locked transaction. Historical blockchain trades remain recorded and are not replayed into the fresh world. Documentation is a summary, not the historical backup itself.

Generated names now use American given names and Chinese names in pinyin, without numeric suffixes. Two RNG draws are preserved per generated name. User-chosen mint names are unaffected. Names may repeat; internal IDs distinguish rats.

## Remaining validation

A real paid pet action was verified; a real mint remains untested, deferred by the user until launch. Holding recognition is implemented; see HOLDING-RECOGNITION.md for current scope and the post-graduation limitation. An internal database backup/restore was completed; automated offsite backup policy remains to be finalized. Cloudflare currently provides DNS, not proxied WAF protection.

## Wallet connection update

Mainnet wallet selection now sequences account access, Robinhood Chain switch (4663), optional network registration if unknown, and SIWE signature without a second site click. Wallet confirmations remain mandatory. No approval or transaction is part of login. Account/network changes outside the requested switch still invalidate the connection. EN/CN disclosure updated to describe the signature accurately.

Validation: TypeScript/build passed; browser integration started on Ethereum mainnet, emitted chainChanged on switching, signed in automatically, and completed the simulated burn/recovery test without browser errors. Network registration uses public network details from https://docs.robinhood.com/chain/add-network-to-wallet/ ; no private RPC key is exposed.

## Care feedback and layout

Verified the user-supplied receipt ending 610dcd in the production ledger: pet action for Mei, 5000 RATTERY, applied once. No new burn was executed. Pet reduces acute stress by up to 0.05 scaled by (1 - cortisol). The interface now explains this and the one-hour cooldown, lists recent applied actions, places Confirm Burn before Cancel and increases button spacing. Public observer exposes only the pet timestamp derived from its cooldown; no wallet or private care ledger is exposed. A brief heart label marks newly confirmed petting for 15 seconds. Cinema controls use viewport positioning and safe-area spacing.

## Inline care help

Added a question-mark button beside Mint & care. A native modal dialog explains all ten actions, configured RATTERY costs, real-hour cooldowns, irreversible burns, separate ETH fees and simulation effects in English/Chinese. Native dialog supports Escape and keyboard focus containment; explicit close and Got it buttons are provided.

## Holding validation

Residence boundary tests passed for exact 7/30/90 days, below-threshold reset, no backdating and no time credit during an unverified gap. Existing browser authentication, reservation, simulated burn and recovery integration passed with migration 011. Frontend and observer published; worker rollout checked separately for live valuation.
