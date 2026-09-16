# Security architecture

Treat wallet providers, client state, names, chain responses and snapshot payloads as untrusted. Wallet names are self-reported, not vendor authentication. Do not inject untrusted markup.

Server configuration selects upstream services; RPC credentials stay server-side. Snapshot checksums do not authenticate the publisher. Public blockchain captures may link wallets to individuals, so raw histories are excluded from Git.

## Current controls
- Explicit wallet connection, no automatic signing/spending/transactions.
- Account/network changes invalidate the connection.
- Input/receipt validation, exact-unit helpers and duplicate handling.
- Bounded caches, timeouts, read-only endpoint guards and snapshot checks.
- Self-hosted fonts, no added wallet relay or remote icons.
- nosniff, frame denial, referrer policy and restricted camera/microphone/geolocation.
- Partial CSP: object-src, base-uri and frame-ancestors.

This is not a complete CSP, production authentication service or independent penetration test.

## Financial release requirements
Server-issued short-lived single-use SIWE challenges; secure sessions; authenticated ownership; atomic intent/receipt consumption; exact sender/token/chain/amount/status/confirmations; durable action records; recovery without double charging. Reject stale intents, replayed receipts and foreign ownership.

Never request seed phrases/private keys or rely on browser success flags. Do not enable real burns until the final contract and complete flow are verified.

## Repository controls
Ignore deployment metadata, local environments, captures, backups, raw Blender files and unlicensed audio. Scan staged content. CI has read-only permissions, pinned action commits and no production secrets. Review dependency updates.

GitHub secret scanning and push protection depend on repository visibility/account features; verify settings. No scanner guarantees discovery of every secret.

[GitHub secure use](https://docs.github.com/en/actions/reference/security/secure-use) · [Push protection](https://docs.github.com/en/code-security/concepts/secret-security/push-protection)
