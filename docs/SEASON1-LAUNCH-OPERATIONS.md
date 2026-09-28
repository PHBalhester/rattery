# Season I launch — 28 September 2026

Opening: 2026-09-28 13:00 America/Sao_Paulo (16:00 UTC).
Closing: 2026-10-05 00:00 America/Sao_Paulo (03:00 UTC).
Nest switching closes five hours before the season closes.

## Deployed components

- Action router: `0x2374A8A715f5ca87ae43609c9bdc74691D5b7B57`, Robinhood Chain 4663.
- Deployment transaction: `0xfab4e6ec2e1843361ea195685fa0ae457f5df33f92b388218eef51a7e2b8dc28`.
- Runtime hash: `0xa178e0412425593b21be2ad608fbc036b4a9c11128d01628b33403d06ee05426`.
- Operator: `0xd40ed0214353b746fd567fa4a57409d1b5709988`.
- Dedicated service signer: `0xB476EfAc1611d4E3Bc5A01121a15B44676AE496E`.
- Railway payment deployment: `22b33ca9-de4b-44f8-9b01-6cb84d9cd51b`.
- Vercel deployment: `rattery-1khdcmt3l-pedrohbalhester-2682s-projects.vercel.app`, aliased to rattery.tech.
- Source: season1-launch `fa74c19`; integrated into ui-clarity `83eb57a`. No main merge.
- Production migration: `013_season_actions.sql`, new tables only; payment role SELECT/INSERT/UPDATE.

The dedicated signer key is a Railway secret, authorized by the operator. Never commit or log it. Prize funds are separate. Initial confirmed signer funding: 0.0012 ETH; top-ups are the operator's responsibility.

## Runtime behavior

The public same-origin API exposes authenticated quote/finalize and public overview through `/api/payment?op=season/...`. Contract clock gates opening and closing. The UI polls every 15 seconds and unlocks only when the verified backend reports open. Join/feed/shield/attack burn RATTERY atomically in the action contract. Exact-amount approval and action execution each require the player's wallet confirmation.

Every 600 seconds, the worker persists a colony/oracle observation and a signed checkpoint transaction before broadcasting it. The first checkpoint is due at 13:10 Sao Paulo. An advisory lock prevents concurrent workers. The exact signed transaction is reused on retries. Missing observations older than 60 seconds stop progression; do not invent historical colony stress or skip slots. Recover using auditable historical observations and the contract's sequential slot guard. If a transaction reverts, investigate before replacing it. Do not erase action or checkpoint history.

Stress uses the mean of living residents' individual wellbeing stress. Below 30% is happy; 30–45% is neutral; 45% or higher is stressed. Scores retain half-points. During this season's US regular market hours, token oracle direction is compared with the previous weekday close. Outside regular hours the stock multiplier is neutral. No simulation, resident identity or engine-version changes were made.

RATTERY fixed-dollar quotes currently use the confirmed canonical pool's spot price and ETH/USD oracle, with a short expiry. This is not a TWAP implementation. Stock watch separately shows real token oracle snapshots with 24-hour and 7-day changes; those are not the final weekly score adjustment.

## Verification and remaining work

Passed: 16 atomic-contract groups locally and against a real-token fork; backend quote/auth/timing/idempotency checks with real test PostgreSQL; production build; desktop and mobile-width UI gating; live contract code/immutables; production SIWE login/logout and rejection of pre-opening quotes; live stock oracle/reference integration. Browser mobile-width checks do not establish performance on a physical phone. No paid Season burn has been submitted by the agent.

Keep the development-only 3D nest artwork separate. Weekly closing score adjustment, eligibility/reward accounting, stock-token prize swaps/distribution, and buyback/burn automation remain work for this week. Final payout code must reconcile canonical contract events, including actions whose browser never called finalize. The existing global burn collector may attribute the router's burns to the router; use the action event wallet for Season player accounting. Contract events are authoritative. Pending submitted actions are recoverable in the player's browser with "Check submitted action".

## Production visual release (13:11–13:13 Sao Paulo)

- User explicitly authorized publishing all Season presentation.
- Live artwork source: `9d059c5` (season1-live-visuals). Main remains unchanged.
- Current Vercel deployment: `rattery-iolk0pmc7-pedrohbalhester-2682s-projects.vercel.app` (rattery.tech).
- Current Railway deployment: `0ba3ac5c-6ea1-4883-a8bf-4b3e4492bf58`.
- Nest geometry is batched, mascot LOD limited, growth driven by live onchain scores. Visual mascots are cosmetic and do not add residents to World.rats.
- Confirmed contract events drive feed, shield and attack effects. Presentation polling uses a bounded cached confirmed log window. It is not a durable payout indexer. Demo controls and debug globals are absent from the production page.
- Prize panel displays the announced $1,000 opening contribution plus the weekly fee allocation. Actual fee total is explicitly awaiting reconciliation; this panel does not assert treasury funding or a verified combined balance.
- Stock popup shows actual NVDA, AAPL and AMZN token oracle prices and rolling changes.
- First scheduled checkpoint at 13:10 confirmed: `0x076a1b6fa60f4b1922b03c7d6124a343e9018d071182ccee8dfe6e0d75cd0845`. Stored observation: 67 living residents, stress 0.3913625531 (neutral), half-point deltas [0,0,0]. Persisted confirmed=true and onchain colonySlot=1.
- Public-site checks passed for nests, scores, four actions, prize panel, stock prices, mobile-width layout, no demo globals and no page exceptions. Hardware GPU test: RTX 4060 Ti. One production sample with 67 residents was approximately 40 FPS at balanced quality; the earlier 60 FPS integration sample had four demo residents and is not equivalent. Physical phone/laptop performance is still unverified.
- The earlier development-only-art note above is superseded by this explicit release. Winner fireworks still require an authoritative final winner; do not trigger based solely on the current leader.
