# Wallet connection — 2026-09-16

Implemented: browser extension discovery (EIP-6963), legacy injected provider fallback, explicit account permission (EIP-1193), EN/CH project panel, address/network display and local disconnect. No SDK, new dependency, analytics, remote wallet icons, QR relay, automatic connection or automatic chain switch.

RPC allowlist exercised by tests: eth_requestAccounts, eth_chainId, eth_accounts. There is no signing, approval or transaction request. Address responses are validated. Account/network/disconnect events invalidate the connection; reconnect explicitly. Pending requests time out locally after 60 seconds; late resolutions cannot restore a disconnected session. App disconnection cannot cancel a wallet's pending prompt or revoke wallet-managed permissions. Provider names/identities are self-reported and not authenticated.

The current address is not authentication or ownership proof. Server authorization and payment verification must never trust this client store. Paid care remains disabled. Demonstration care retains fictional A/B accounts.

## Wallet-owned prompts
Wallets control the permission dialog, origin display and warnings. The site supplies its actual origin and metadata (title, application-name, favicon); wallets may choose whether to show those. Localhost remains localhost. We cannot replace native permission text or guarantee a wallet removes “Unknown Signature Type”.

The supplied Rabby screenshot is a text signature, not a connection request. Do not request a signature solely to show branding.

## Authentication message for the next server stage (not enabled)
Use ERC-4361 / Sign-In with Ethereum rather than a bare numeric nonce. Proposed statement:

Welcome to RATTERY, a living 3D rat colony. Sign in to manage your profile and eligible rat interactions. This signature verifies wallet ownership only. It does not authorize token transfers, spending approvals, or minting. Each paid action requires separate confirmation.

The full standard message must include the actual domain and URI, wallet address, Version: 1, Chain ID, cryptographically random server-generated nonce, Issued At and short Expiration Time. Do not hardcode rattery.tech on localhost or accept a client-selected trusted origin. Server must validate the exact issued message, signature (including supported contract wallets), origin, nonce and expiration; atomically consume the nonce and issue a secure HttpOnly session with CSRF protection. Logout invalidates the session. No production authentication is claimed by this connection layer.

## Validation
- npm run build: passed (existing large bundle warning remains).
- scripts/wallet-browser-test.cjs: passed with mocked provider; no automatic RPC, discovery/deduplication, read-only methods, account/network changes, rejection, malformed responses, Escape, 390px overflow, Chinese and absent wallet.
- scripts/care-browser-test.cjs: passed for demo mint/burn, owner controls, cooldown, mobile and live payment guard.
- Mobile screenshot visually inspected.
- Real Rabby/MetaMask confirmation and physical mobile wallet testing remain outstanding. No real wallet signature or transaction was requested during these tests.

## Primary references
- https://eips.ethereum.org/EIPS/eip-1193
- https://eips.ethereum.org/EIPS/eip-6963
- https://eips.ethereum.org/EIPS/eip-4361
