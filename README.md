# RATTERY

[![RATTERY brand illustration](public/og.png)](https://rattery.tech)

[![CI](https://github.com/PHBalhester/rattery/actions/workflows/ci.yml/badge.svg)](https://github.com/PHBalhester/rattery/actions/workflows/ci.yml)

### A shared world of digital rats.

RATTERY is an interactive rat-colony simulation built with React, TypeScript and Three.js. Explore a connected habitat, follow individual residents and observe how resources, social relationships and market events influence life in the colony.

**Status: live production.** The shared colony, signed wallet login, native RATTERY burns and paid care are deployed at [rattery.tech](https://rattery.tech). Real mint and paid-care burns have been verified in production. Mint records ownership within RATTERY; it does not create an NFT. This is an experimental simulation, not a scientifically validated animal model. [Current release notes](docs/PRODUCTION-RELEASE-2026-09-18.md).

[GitHub](https://github.com/PHBalhester/rattery) · [Website](https://rattery.tech) · [X / Twitter](https://x.com/ratterytech) · [Documentation](docs/README.md) · [Security](SECURITY.md)

**Everyone observes the same colony. No wallet is required to watch.**

## Experience
- Full-screen 3D habitat with shelters, tunnels, enrichment and exercise wheels.
- Articulated rats with independent chest/pelvis movement, tail joints and natural idle behaviors.
- Social affinities, exploration, crowding, recovery and contextual interactions.
- Condition panels, alerts, individual records, family trees and memorials.
- English and Chinese interfaces and a distraction-free viewing mode.
- Deterministic simulation, canonical trade replay and validated snapshots.
- Read-only Pons V2 market ingestion through server-side chain adapters.
- One-click connection flow: request account access, Robinhood Chain switch and a wallet-confirmed SIWE signature.
- Persistent mint/care reservations, native burns and receipt reconciliation.
- Cosmetic holding recognition at US$100: 7/30/90 verified days and caregiver identity. [Rules and limits](docs/HOLDING-RECOGNITION.md).

## RATTERY token

| Field | Details |
| --- | --- |
| Project / symbol | RATTERY / $RATTERY |
| On-chain name | rattery experiment |
| Network / chain ID | Robinhood Chain / 4663 |
| Contract | `0xC322305e79337300b59fF48389f8C9A1D9E0de76` |
| Explorer | [View token](https://robinhoodchain.blockscout.com/token/0xC322305e79337300b59fF48389f8C9A1D9E0de76) |
| Launch page | [Pons](https://www.ponsfamily.com/launchpad/0xC322305e79337300b59fF48389f8C9A1D9E0de76) |

**Verify the network and full contract address. A matching name or symbol does not identify the official token.**

[Token verification](docs/RATTERY-TOKEN.md). Connecting a wallet does not approve or transfer tokens; paid actions require separate wallet confirmation.

## Quick start
Use Node.js 24 LTS and npm. Python 3 is needed for the publication checker and Blender scripts.

```sh
npm ci
npm run dev
```

Open http://localhost:5173. Plain Vite does not serve the serverless API, so this starts demonstration mode. No wallet is required to observe.

```sh
npm run build
npm run preview
npm run typecheck:api
npm run test:ci
```

Install browser-test support separately:

```sh
npx --no-install playwright install chromium
# With the development server running:
npm run test:wallet
```

The soundtrack is **not distributed** in this repository. See [Assets](docs/ASSETS.md) for optional audio setup and rights. The colony works without audio.

## Market reactions
Production trades use recorded historical ETH/USD quotations. Local demonstration replay retains a fixed simulation reference. Reactions depend on individual condition, eligibility, affinity and cooldowns.

| Simulation USD | Buy | Sell |
| --- | --- | --- |
| Below 50 | Light resources; no trade animation | Light alert; no trade animation |
| 50–249.99 | Curiosity | Vigilance or shelter seeking |
| 250–499.99 | Exploration, play and friendly approaches | Moderate stress and less play |
| 500–999.99 | Collective wellbeing and positive interactions | Stress pulse and conflict opportunity |
| 1,000+ | Possible courtship between eligible friendly adults | Possible conflict between adult rivals |

These are simulation rules, not guaranteed visible events. [Full rules and care costs](docs/SIMULATION.md).

## Wallet and payment boundaries
Connection uses EIP-6963/EIP-1193. Production requests account access, the Robinhood Chain network (4663), and a SIWE login signature with domain, expiry and a one-use nonce. Login does not approve or transfer tokens. Each paid action separately requests a direct native burn after a server-side reservation; the server verifies the canonical receipt with at least 20 confirmations and applies it at most once. Mint records ownership in the project database, not an NFT.

The verified RATTERY contract is `0xC322305e79337300b59fF48389f8C9A1D9E0de76`. Production uses Vercel same-origin proxies and separate Railway services with private PostgreSQL access. Credentials stay in service configuration, never in browser code. Local demonstrations use fictional balances. [Mint/care rules](docs/MINT-CARE-DECISIONS.md).

[Wallet design](docs/WALLET.md)

## Architecture

Production advances on the server, even when visitors leave. Browsers receive confirmed snapshots and interpolate movement. Plain Vite runs a separate local demonstration.

```text
On-chain trades -> Market collector -> Simulation worker
                                             |
                                         PostgreSQL
                                             |
                                      Observer / API
                                             |
                                  React / Zustand / Three.js
```

Wallet authentication and paid-care verification use a separate server-side flow.

| Directory | Purpose |
| --- | --- |
| src/sim/ | Colony rules, navigation, care, ecology and snapshots |
| src/render/ | 3D rendering, motion systems and interface |
| src/market/ | Feed clients, replay and burn primitives |
| src/wallet.ts | Browser extension discovery and connection |
| api/ | Serverless observation/auth/payment proxies and chain utilities |
| server/ | Persistence, SIWE, receipts, market collection and residence monitoring |
| public/models/ | Runtime GLB habitat and rat models |
| public/fonts/ | Self-hosted fonts and license notices |
| scripts/ | Tests, replay tools and asset generators |
| docs/ | Architecture, operations, testing and release guides |
| .github/ | CI, dependency updates and contribution templates |

[Architecture](docs/ARCHITECTURE.md) · [Configuration](docs/CONFIGURATION.md)

## Reproduce deterministic behavior

```sh
npm run test:determinism
```

This controlled test compares matching seeds and trade inputs and checks snapshot/resume equivalence. Production reproduction additionally requires matching engine/configuration, ordered inputs and recorded operator interventions.

## In development: three nests, three tickers

We are designing weekly seasons with three nests representing selected stock tickers. Contributions produce litter points; attacks and shields shape the race. Stock influence is intended to be bounded and applied once when points are created.

**This is planned functionality, not the current live game.** Scoring, funding and distribution details must be finalized before release. [Design status](docs/STOCK-SEASONS.md).

## Operational transparency

Operators can apply temporary assistance and perform recorded recovery interventions. These affect colony outcomes and must be distinguished from ordinary simulation. [Operations and intervention history](docs/OPERATIONS.md).

## Validation and limitations

On September 23, 2026, a read-only production check verified 28 applied mints against successful canonical burn transactions, matching ownership records and applied care events. Each mint burned 500,000 RATTERY, totaling 14,000,000 RATTERY across those transactions. The first verified mint was recorded on September 18, 2026. [First mint burn transaction](https://robinhoodchain.blockscout.com/tx/0x73c42cad9a295880e14b2eb6fbd6a3ae8b74672e9a423826b6bdf375c3af97c9).

CI covers type checks, production build, controlled simulation/security suites and publication checks. Browser tests and long stress runs are separate. Some historical mainnet tests require local captures intentionally excluded from Git.

There is no claim of an independent security audit, universal frame-rate guarantees or zero bugs. Remaining work includes an automated offsite backup policy, wider physical-device coverage and a post-graduation holding-price adapter. Tail collision uses approximate colliders rather than full mesh physics.

[Testing](docs/TESTING.md) · [Release checklist](docs/RELEASE.md) · [Roadmap](docs/ROADMAP.md)

## Research
Rodent research informs design choices, but welfare values are **simulation indices**, not measured stress or diagnostic claims. Market activity is an artistic input, not evidence about animal behavior. [Research](docs/RESEARCH.md).

## Contributing and rights
Read [CONTRIBUTING.md](CONTRIBUTING.md). Report vulnerabilities privately as described in [SECURITY.md](SECURITY.md).

Public visibility does not grant an open-source license. Original code/assets remain reserved until the owner selects a license; third-party materials keep their licenses. See [LICENSE.md](LICENSE.md) and [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
