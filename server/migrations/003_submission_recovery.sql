ALTER TABLE care_intents ADD COLUMN IF NOT EXISTS submission_started_at bigint;
ALTER TABLE care_intents ADD COLUMN IF NOT EXISTS submitted_hash text;
CREATE INDEX IF NOT EXISTS submitted_receipt_lookup ON care_intents(chain_id,token,submitted_hash) WHERE submitted_hash IS NOT NULL;
