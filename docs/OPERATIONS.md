# Operations

Deploy Vite output and api/ functions with npm ci and npm run build. Configure server secrets in deployment settings. Production uses the verified RATTERY contract on chain 4663. Validate configuration, TLS, throttling and component compatibility before each release.

CI passing does not authorize payments or deploy the app. Keep production credentials out of pull-request workflows.

## Snapshots
Use complete canonical prefixes with matching chain/token/birth block/model/configuration. The endpoint validates anchors. Keep publishing operator-controlled. Back up archives and durable histories separately from Git. Review compatibility and regenerate snapshots when rules change.

Monitor replay age, history-limit state, stale snapshots, upstream errors and recovery. Do not hide errors as empty history.

## Recovery
Retain a known-good deployment with compatible configuration/snapshots. Review action/state compatibility before rollback. Pause financial processing on inconsistent state instead of repairing it in the client.

For leaked credentials: revoke/rotate first, investigate access, coordinate history cleanup and rescan. Deleting the latest file does not erase Git history.

## Data
Wallets are public on-chain but may identify users when linked to profiles. Minimize logs and never record raw sessions/auth signatures. Define retention, archival and deletion policies before persistent accounts and indefinite memorial history.


## Operator interventions

Temporary protection has an explicit expiry. It supports resources and individual condition and slows biology. It is not a permanent survival guarantee; normal mortality can resume after expiry.

Recovery is an operator action, not a market event. Record the prior world and engine context. Preserve identities, ownership and historical records. Market replay alone cannot reproduce operator interventions.

Verified recent interventions:
- September 22, 2026: the same 41 residents were revived, with the prior world recorded in engine history and 24-hour protection.
- September 22, 2026: engine v23 added a passing correction to reduce movement deadlocks, preserving residents and history.
- September 23, 2026: after protection expired and the colony became extinct, the same 41 residents were revived. The prior world was recorded; protection was renewed until September 24 at 10:03:59 UTC.

These are dated summaries, not live protection indicators or public database backups. Public observation carries the current protection state. Do not publish private account mappings, credentials or raw backups.

## Release scope

Record source commit, engine version, deployed components and validation. Documentation-only releases do not redeploy every component. Keep a compatible rollback plan.

Automated offsite backup policy remains unfinished. Manual snapshots do not substitute for a scheduled, tested backup process.

## Permanent six-resident core

Production engine v24 supports an explicit operator-selected `permanentCore`: six existing living adults, three females and three males. Their IDs and activation timestamp are persisted in the world and the activation is archived in engine history. Membership does not rotate and has no deadline.

All simulated death causes are blocked for these identities at the common mortality function. They are excluded from snake and crowding target selection. Each biology tick restores their individual energy, warmth, hydration and stress condition; shared market resources are not replenished by this rule. Existing identities, ages, ownership and payment state remain intact. Other residents retain the normal life cycle, including age-related death.

Temporary protection remains separate and applies to the entire colony until its authoritative deadline. Its expiration cannot disable the permanent core. This avoids market-inactivity extinction during normal simulation operation; it does not promise infrastructure availability or recovery from data corruption.

Validation: `npm run test:permanent-core` covers all death causes, expiry, individual-only assistance, predator/crowding exclusion, deterministic persistence, exact production ticks and extended silence.
