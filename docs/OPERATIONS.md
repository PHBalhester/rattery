# Operations

Deploy Vite output and api/ functions with npm ci and npm run build. Configure server secrets in deployment settings. Keep the final token unset until verified. Check real staging responses, headers, TLS and throttling before production.

CI passing does not authorize payments or deploy the app. Keep production credentials out of pull-request workflows.

## Snapshots
Use complete canonical prefixes with matching chain/token/birth block/model/configuration. The endpoint validates anchors. Keep publishing operator-controlled. Back up archives and durable histories separately from Git. Review compatibility and regenerate snapshots when rules change.

Monitor replay age, history-limit state, stale snapshots, upstream errors and recovery. Do not hide errors as empty history.

## Recovery
Retain a known-good deployment with compatible configuration/snapshots. Review action/state compatibility before rollback. Pause financial processing on inconsistent state instead of repairing it in the client.

For leaked credentials: revoke/rotate first, investigate access, coordinate history cleanup and rescan. Deleting the latest file does not erase Git history.

## Data
Wallets are public on-chain but may identify users when linked to profiles. Minimize logs and never record raw sessions/auth signatures. Define retention, archival and deletion policies before persistent accounts and indefinite memorial history.
