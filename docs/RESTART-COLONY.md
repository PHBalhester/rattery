# Operator restart of an extinct colony

This is a manual operator action, never an automatic response to inactivity. Run just before the announced opening: once the worker resumes, biological time advances even without visitors.

The operation refuses a living colony, an active worker lease, stale expected revision/version, unresolved payment reservations/reviews, inconsistent ownership or care sequence. It inserts the entire previous world into the operator-only transition audit and creates four founders with unused IDs. It preserves rat records, genealogy, ownership, burn receipts, care events, residence, trade cursors and applied trades. Old owned rats remain historical identities; ownership is never reassigned to a new rat. New care retains the previous cumulative burned amount and sequence.

No historical trade is replayed. Pending trades retain their existing queue semantics. Simulation day returns to zero and the real-time anchor becomes the operation time. The database tick and revision remain monotonic for historical trade references. A reset does not reverse a death or refund a burn.

## Procedure

1. Obtain explicit approval for the new round. Back up the production database and verify the backup can be restored into an isolated database. Disable new payment submissions, reconcile all in-flight actions, then stop the worker. Do not cancel a submitted transaction to bypass this check.
2. Use the same reviewed source revision for the operator, worker and payment service. Read the current `colony_state` revision and engine version. Supply operator credentials privately through `RATTERY_OPERATOR_DATABASE_URL` and verified TLS CA through `RATTERY_OPERATOR_DATABASE_CA`; never paste secrets into command arguments or Git.
3. Rehearse against an isolated restored database, then run `npx tsx scripts/restart-colony.ts TRANSITION_ID EXPECTED_REVISION EXPECTED_ENGINE_VERSION --dry-run`. This executes the full transaction and rolls it back.
4. Inspect the plan. Run the same command with `--commit` only at the approved launch time. The transition ID is unique; repeating a commit fails rather than resetting twice.
5. Set the observer's configured run ID to the new round, start the matching worker, verify a fresh public snapshot with four living founders, the correct engine version and advancing ticks. Verify receipts, ownership, memorial and trade cursor counts remain intact before re-enabling payments.

A dry run rolls back table writes. No script deploys services, changes the observer run ID, deletes historical records or performs a blockchain transaction. Failed operations roll back the archive and the replacement together. After a successful reset, do not restore an old snapshot over new payments; pause and perform a forward recovery instead.
