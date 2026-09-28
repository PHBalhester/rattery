# Security hardening preview validation — 2026-09-28

Source reviewed: security-hardening at 8f134cc, based on main. No production deployment or main merge was performed.

Preview: https://rattery-iylh529ro-pedrohbalhester-2682s-projects.vercel.app

The preview retains Vercel authentication. Tests used the project's existing automation access; no access token is included in this report.

## Passed

- Vercel remote build completed with the logged install command `npm ci --ignore-scripts`. The project API reports `installCommand: null`, so there is no project-level override. The build used Node 24 and completed both the Vite and API compilation.
- Colony 3D, EN/ZH switching, wallet dialog and all five studio routes loaded: rat-studio, snake-studio, wheel-studio, mating-studio and gait-studio.
- Audio playback advanced with readyState 4 and no media error in Edge/Windows and Chromium/Linux.
- No page errors, console errors, failed asset responses or CSP violations in the final six-route preview sweep. No unexpected `Refused to...` message was observed.
- The existing wallet test passed against the remote preview with an injected test provider: provider discovery, connect, rejection, account/network invalidation, mobile layout, Chinese and no-wallet fallback. This does not validate real wallet extensions, SIWE signatures, or token burns.
- The local CSP test passed all six routes, including its deliberate external-fetch and inline-script blocking checks.
- Authenticated `curl -I` from Linux returned HTTP 200 and the exact CSP from vercel.json, HSTS `max-age=63072000`, COOP `same-origin-allow-popups`, and `X-Frame-Options: DENY`.
- Railway's configured payment-service RATTERY_RPC uses the private Alchemy provider, not the public Robinhood endpoint. A read-only eth_chainId probe returned 0x1237 (4663). Credentials and the full RPC URL were not exposed. This verifies the configured variable and endpoint; a separate SSH check of the running container timed out.
- GitHub private vulnerability reporting was enabled and read back as enabled. SECURITY.md now links to the private reporting form.

## Packaging finding

The first clean-checkout preview returned 404 for `/audio/conifers.mp3`. That licensed asset is intentionally ignored by Git. The corrected preview includes the existing local project copy; no new download or license assumption was made. A future deploy from a fresh clone must provision the authorized audio file before building. Do not interpret a missing audio asset as a CSP failure.

## Release gates still open

The user explicitly deferred the real wallet/login/paid-care test. In addition, the current payment adapter only accepts the production origin and hostname; an arbitrary Vercel preview cannot complete that payment flow as configured. Preview environment variables are not the production payment environment. No origin checks or payment settings were weakened to bypass this limitation.

Do not mark real payment validation complete from the simulated wallet test. Keep main and production unchanged until the release gates are satisfied. Because this security branch starts from main while the current UI release is on ui-clarity, integrate the security changes with the intended UI release before a production build instead of deploying this older UI wholesale.

The Windows antivirus locally adds its own domains to HTTPS CSP headers. To avoid relying on that modified policy, the full remote sweep was repeated in Chromium/Linux and origin headers were checked directly with Linux curl. The unmodified strict policy passed there.

Simulation, config, payment implementation and identities were not changed by this review.
