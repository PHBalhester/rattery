# Architecture

## Application
src/store.ts starts the engine and exposes state through Zustand. React presents panels; Three.js renders generated GLB assets with procedural fallbacks. English/Chinese language preference is stored locally.

Simulation advances in discrete ticks. Random state is part of the world and snapshots. Canonical replay binds market events to simulation time, preserving reproducibility for a matching seed/configuration/history. Rendering is not payment authority.

## Market
api/chain.ts provides configured metadata; api/trades.ts supplies ordered chunks. The client validates responses, handles duplicates, retries and catch-up limits. Do not replace canonical ordering with arrival order.

Configuration supports chain IDs 4663 and 46630. Protocol mappings live in api/_lib/pons.ts; verify against the intended deployment before release. CONFIG.market.ethUsdRef is fixed for determinism, not a live quote.

## Snapshots
Envelopes include world/RNG, cursor, identity, model/configuration version and checksum. The service validates identity and the chain anchor. Checksums detect corruption, not authorship. Use only an operator-controlled publisher.

Collectors/builders require complete canonical prefixes, reject gaps and replace files atomically. Raw archives and wallet-linked captures belong in controlled storage, not Git.

## Motion and authority
Articulated assets support gait phases, independent torso motion and secondary tail/head movement. Navigation/separation are simulation concerns; tail collision is approximate. Inspect ?view=rat-studio, ?view=gait-studio and ?view=wheel-studio.

Browser worlds, care reducers and connected addresses are not server authorization. Real care requires authenticated ownership, durable action records and deduplicated verified receipts.
