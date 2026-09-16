# Testing

## Clean-checkout baseline
Node 24; Python 3 for publication checks:

```sh
npm ci
npm run build
npm run typecheck:api
npm run test:ci
npm run check:publication
npm audit
# Linux x64: official Gitleaks binary verified against a pinned checksum
python3 scripts/scan-secrets.py
```

The publication checker scans staged/tracked files locally; it does not upload content. npm audit queries the npm advisory service. Neither proves absolute security.

test:ci runs controlled determinism, replay, trade rules, care/burn, API guards, social, navigation, exploration, ecology, enrichment, separation/crowding, feed, snapshot, memorial and IK suites. No private credentials or real transactions are required.

## Browser tests
Start npm run dev separately:

```sh
npx --no-install playwright install chromium
npm run test:wallet
node scripts/panels-browser.cjs
node scripts/audit-relaxation-browser.cjs
```

Chromium is the default. RATTERY_BROWSER_CHANNEL=msedge selects an installed Edge. Output goes under ignored test-results/. Audio tests need a locally licensed file; wallet tests use a mocked provider.

Historical mainnet/browser/snapshot-builder suites may require local captured fixtures under test-results/. They are not distributed. Use the controlled baseline on a fresh clone; do not publish real user captures to satisfy tests.

## Extended checks
npm run test:stress, test:robustness and test:robustness:parallel cover longer scenarios. Rendering probes cover contact phases, low FPS and obstacle/wheel clearance. Some historical probes reflect earlier visuals and need review when rendering changes.

Actual wallets, physical Android/iOS, Safari, mobile networks, WebGL loss and long sessions remain release checks. Record versions, hardware, fixtures and limitations. Mock payment tests are not real-payment validation.
