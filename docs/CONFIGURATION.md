# Configuration and API

Use Node 24, npm ci and npm run dev. No credentials are needed for demo mode. Examples are templates; other .env files and .vercel metadata are ignored.

Plain Vite does not execute api/*.ts. Use RATTERY_API_PROXY with an operator-controlled endpoint or a compatible Vercel development environment. Do not accept user-supplied proxy origins.

| Variable | Purpose |
| --- | --- |
| RATTERY_CHAIN_ID | 4663 (default) or 46630 |
| RATTERY_RPC | Server RPC; configured values may contain credentials |
| RATTERY_CA | Final token; empty retains pre-launch/demo mode |
| RATTERY_BIRTH_BLOCK | Launch block, decimal or hexadecimal |
| RATTERY_CURVE | Optional verified curve override |
| RATTERY_POOL_ID | Optional verified pool identifier |
| RATTERY_POOL_MANAGER | Verified override; required for testnet |
| RATTERY_CHUNK_BLOCKS | Chunk size, default 1200 |
| RATTERY_LOGS_RANGE | Log range, default 1200 |
| RATTERY_BLOCKSCOUT | Configured explorer API |
| RATTERY_SNAPSHOT_URL | Optional operator-controlled HTTPS source |
| RATTERY_API_PROXY | Development proxy |

No private-key/seed-phrase setting exists. Never introduce VITE_ secrets: browser build variables are public. Token addresses are public identifiers.

## Read-only API
- GET /api/chain: launch state, metadata and cursor.
- GET /api/trades?chunk=N: ordered events for a bounded chunk.
- GET /api/snapshot: validated configured snapshot or no snapshot.

Do not treat failed responses as successful empty histories. Cache rules differ for finalized/head data; chunk/protocol changes require replay/cache review. These endpoints do not authenticate users or process payments.

snapshot:collect and snapshot:build generate local archives/checkpoints. Read script usage before operating. Some capture/integration suites access network services; they are separate from controlled CI.
