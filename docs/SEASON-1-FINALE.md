# Season I closure and result publication

Season I gameplay ends October 5, 2026 at 00:00 America/Sao_Paulo (03:00 UTC).
The immutable action contract enforces the cutoff. The site disables new actions
at the same deadline, including dialogs left open before midnight. Previously
submitted transactions can still be checked.

The frontend polls the read-only `/api/season-result` endpoint. After closure it
shows **Result being verified** until all 930 checkpoints are confirmed and the
weekly reference prices are reviewed. It never crowns the current live leader
as a substitute for settlement.

## Required price review — still pending

Owner decision on October 4: retain the whitepaper's official regular-session
closing prices for September 25 and October 2, with consistent split adjustment
and no dividend adjustment. The onchain feeds had observations several hours
before the close; they are not accepted as official closing prints.

`api/_lib/seasonClosingReferences.ts` intentionally exports null. After reviewing
the six prices and corporate actions, populate the typed reference object with
integer prices, shared decimal precision per pair, review timestamp and direct
source URLs. Redeploy. Do not substitute rolling seven-day returns or zeroes.
The result remains pending until this explicit publication.

## Final-result safeguards

The endpoint checks chain 4663, deployed runtime hash, immutable season and
opening/closing times, a 20-block confirmed anchor and all 930 checkpoints.
Action logs reconcile against stored gross production and membership count.
It applies the weekly adjustment once, rounds exact halves away from zero,
floors scores at zero and applies the whitepaper's production/order tie-break.
The block hash is rechecked after reading logs.

The verified result supplies the final scores to the 3D nests. The winner gets
the existing camera focus, crown, celebration and company-colored fireworks.
The result dialog opens after the animation, once per session; a persistent
card can reopen it. Reduced-motion mode skips the effects and delay. Refreshing
live gameplay scores cannot overwrite the settled visual scores.

## Payments

Payments are planned for Monday October 5, late morning in Sao Paulo. Their
completion and execution remain separate. This release adds no payout signer,
funding transaction, token transfer or payment activation.

## Verification

- `tsx scripts/season-finale-test.ts`: boundary, missing checkpoints/prices,
  weekly adjustment, tie-break, zero floor, truncated logs, runtime, stale chain,
  and reorg failures.
- `node scripts/season-finale-browser.cjs`: dev server on port 5176;
  ARTIFACT_DIR must point to a writable image directory. Windows Edge / D3D11.
  Mock results are test fixtures, never published reference prices.
- Build and API typecheck before deployment; verify the live endpoint and
  production asset afterward.
