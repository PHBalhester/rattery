# Opus patch integration

Date: 2026-09-26
Base: 7e3f505, matching origin/main when fetched.
Branch: integrate/opus-ui-season-diorama
Checkout: /home/phbal/Rattery/opus-ui-release

## Applied in order

1. 12972f9 — UI clarity, needs and grouped care actions.
2. 44148bd — Season 1 rail, bilingual tutorial and licensed self-hosted font.
3. 6d0ddb7 — Diorama lighting, postprocessing, materials and follow camera.

All three applied with git am -3 without conflicts. Existing uncommitted work in rattery and permanent-core-release was preserved. Neither src/sim nor src/config.ts differs from the base; engine version and permanent-core logic remain unchanged. No production deployment, public push or live financial transaction was performed.

## Integration corrections

- Resize the postprocessing render targets when AdaptiveQuality changes the pixel ratio, not only on a window resize.
- Retain and dispose the environment render target, and dispose every composer pass during teardown.
- Replace the reversed-edge smoothstep in the vignette with an ordered-edge expression.
- Keep the Whitepaper button within narrow Season cards.
- Correct draft tutorial wording: entry is not the only paid action, and biological family growth does not itself award Season points. Distinguish rat care from Season actions.
- Update panel coverage for the welcome dialog, mobile default-hidden panels, five individual vitals and mobile resident selection; cover the Season tutorial in English and Chinese.
- Add an isolated PaidCare browser test covering production-origin gating with fully intercepted local HTTP and a fake provider. Authentication is seeded as a test fixture; this is not a live login or backend validation test.
- Add a render lifecycle test for four atmosphere quality levels, render-target resizing and disposal.

SEASON_RULES_FINAL remains false. WHITEPAPER_URL remains empty. The unpublished whitepaper and the separate local Season implementation were not bundled into this UI release.

## Validation

- npm ci --ignore-scripts: completed; audit reported zero vulnerabilities.
- npm run build: passed. Vite retains a warning for the main bundle exceeding 500 kB.
- npm run typecheck:api: passed.
- npm run test:care: passed.
- npm run test:burn: passed.
- npm run test:render:adaptive: all three constituent suites passed.
- npm run test:permanent-core: passed, including fixed identities, protection expiry, aging, deterministic reload and crowding.
- npm run test:care:build: passed.
- node scripts/paid-care-ui-browser.cjs: passed at widths 1440 and 390; selection alone sends no payment, review precedes burn, exact 5,000-token pet calldata, one mocked submission, recovery without a second burn, and owner-only care.
- node scripts/atmosphere-browser.cjs: passed; four quality levels, corresponding render-target sizes, optional dust and complete pass/environment teardown.
- node scripts/panels-browser.cjs: passed at 1440x900, 1024x768, 390x844 and 360x740, including English and Chinese tutorials, mobile resident selection, visible Trade action, panel toggles and no captured JavaScript or shader errors. Screenshots are stored in ignored test-results/browser.

To run browser coverage, start the default Vite server on localhost:5173. The isolated paid-care test additionally requires VITE_MAINNET_PAYMENTS=true on localhost:5174. It intercepts https://rattery.tech in its private browser context and serves only local code and fake API responses; it never contacts or writes production. All providers and transactions in that test are synthetic.

## Existing exploration test failure

npm run test:exploration fails at assert(far > 200 && returned) both on the untouched 7e3f505 implementation and after the patches. In the deterministic seed-9 fixture, maximum excursion is approximately 839.91 units and the closest return after the excursion is approximately 2.97 units from the center. The test requires less than 2 units. The v25 navigation already treats shared waypoints as guidance and permits ordinary route-end arrival within 12 units.

This evidence points to an outdated exact-center expectation; it is not proof that every movement behavior is correct. No production movement code was changed and the assertion was not weakened merely to make the suite pass. A follow-up should test completed route cycles and a valid nest return against the intended navigation semantics.

## Remaining release checks

The automated viewport checks exercise layout, not physical phones or ordinary laptop GPUs. This headless environment falls back to minimal quality and its frame rates are not a representative device benchmark. Test a real phone and a typical laptop before publishing the heavier visual update.

The PaidCare fixture verifies client interaction and transaction intent only. A supervised inexpensive real care action on rattery.tech after deployment remains necessary to verify the complete wallet, backend, chain and persisted-state path. No such paid action was attempted here.
