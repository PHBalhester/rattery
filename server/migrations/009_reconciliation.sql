ALTER TABLE care_intents ADD COLUMN reconcile_at bigint;
CREATE INDEX pending_burn_reconciliation ON care_intents(coalesce(reconcile_at,0),created_at) WHERE status='reserved' AND submitted_hash IS NOT NULL;
