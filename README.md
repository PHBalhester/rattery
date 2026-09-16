# RATTERY
### A living 3D colony shaped by community activity

RATTERY is an interactive rat-colony simulation built with React, TypeScript and Three.js. Explore a connected habitat, follow individual residents and observe how resources, social relationships and market events influence life in the colony.

**Status: pre-production.** Browser-wallet connection is available. Production authentication, minting and paid care are **not enabled**. This is a working simulation, not a completed financial service or a scientifically validated animal model.

[GitHub](https://github.com/PHBalhester/rattery) · [Website](https://rattery.tech) · [X / Twitter](https://x.com/ratterytech) · [Documentation](docs/README.md) · [Security](SECURITY.md)

## Experience
- Full-screen 3D habitat with shelters, tunnels, enrichment and exercise wheels.
- Articulated rats with independent chest/pelvis movement, tail joints and natural idle behaviors.
- Social affinities, exploration, crowding, recovery and contextual interactions.
- Condition panels, alerts, individual records, family trees and memorials.
- English and Chinese interfaces and a distraction-free viewing mode.
- Deterministic simulation, canonical trade replay and validated snapshots.
- Read-only Pons V2 market ingestion through server-side chain adapters.
- Browser-wallet discovery without automatic signing or spending permissions.
- Demonstration mint/care with fictional accounts and fictional tokens.

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
Amounts use a **fixed ETH/USD simulation reference**, not a live price oracle. Reactions depend on individual condition, eligibility, affinity and cooldowns.

| Simulation USD | Buy | Sell |
| --- | --- | --- |
| Below 50 | Light resources; no trade animation | Light alert; no trade animation |
| 50–249.99 | Curiosity | Vigilance or shelter seeking |
| 250–499.99 | Exploration, play and friendly approaches | Moderate stress and less play |
| 500–999.99 | Collective wellbeing and positive interactions | Stress pulse and conflict opportunity |
| 1,000+ | Possible courtship between eligible friendly adults | Possible conflict between adult rivals |

These are simulation rules, not guaranteed visible events. [Full rules and care costs](docs/SIMULATION.md).

## Wallet and payment boundaries
Connection uses EIP-6963/EIP-1193 and requests a public address. It does **not** authenticate ownership on a server, approve spending, sign a message or submit a transaction. Disconnecting clears the app connection; wallet-managed permissions are revoked within the wallet.

Demo care spends fictional tokens. The final RATTERY address, server authentication, persistent payment intents and atomic receipt consumption remain release requirements. Never enable production payments by simply changing a UI flag.

[Wallet design](docs/WALLET.md) · [Security boundaries](docs/SECURITY-ARCHITECTURE.md)

## Architecture
```text
React panels / wallet connection
        ↕
Zustand → deterministic simulation → Three.js
        ↑
Canonical market replay / validated snapshots
        ↑
Read-only API: chain / trades / snapshot
        ↑
Configured RPC, explorer and trusted snapshot publisher
```

| Directory | Purpose |
| --- | --- |
| src/sim/ | Colony rules, navigation, care, ecology and snapshots |
| src/render/ | 3D rendering, motion systems and interface |
| src/market/ | Feed clients, replay and burn primitives |
| src/wallet.ts | Browser extension discovery and connection |
| api/ | Read-only serverless endpoints and chain utilities |
| public/models/ | Runtime GLB habitat and rat models |
| public/fonts/ | Self-hosted fonts and license notices |
| scripts/ | Tests, replay tools and asset generators |
| docs/ | Architecture, operations, testing and release guides |
| .github/ | CI, dependency updates and contribution templates |

[Architecture](docs/ARCHITECTURE.md) · [Configuration](docs/CONFIGURATION.md)

## Validation and limitations
CI covers type checks, production build, controlled simulation/security suites and publication checks. Browser tests and long stress runs are separate. Some historical mainnet tests require local captures intentionally excluded from Git.

There is no claim of an independent security audit, universal frame-rate guarantees or zero bugs. Release work includes persistent payment/authentication services, deployed infrastructure verification, physical mobile/Safari tests, long-term genealogy storage and asset rights review. Tail collision uses approximate colliders rather than full mesh physics.

[Testing](docs/TESTING.md) · [Release checklist](docs/RELEASE.md) · [Roadmap](docs/ROADMAP.md)

## Research
Rodent research informs design choices, but welfare values are **simulation indices**, not measured stress or diagnostic claims. Market activity is an artistic input, not evidence about animal behavior. [Research](docs/RESEARCH.md).

## Contributing and rights
Read [CONTRIBUTING.md](CONTRIBUTING.md). Report vulnerabilities privately as described in [SECURITY.md].

Public visibility does not grant an open-source license. Original code/assets remain reserved until the owner selects a license; third-party materials keep their licenses. See [LICENSE.md](LICENSE.md) and [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
