
-- Isolated staging schema. No production financial endpoint is enabled.
CREATE TABLE IF NOT EXISTS auth_challenges (
 id uuid PRIMARY KEY, wallet text NOT NULL, message text NOT NULL,
 expires_at bigint NOT NULL, consumed boolean NOT NULL DEFAULT false
);
CREATE TABLE IF NOT EXISTS auth_sessions (
 digest text PRIMARY KEY, wallet text NOT NULL, expires_at bigint NOT NULL
);
CREATE TABLE IF NOT EXISTS colony_state (
 id integer PRIMARY KEY CHECK(id=1), world jsonb NOT NULL, revision bigint NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS rat_records (
 id text PRIMARY KEY, name text NOT NULL, born_at double precision NOT NULL,
 mother_id text REFERENCES rat_records(id) DEFERRABLE INITIALLY DEFERRED,
 father_id text REFERENCES rat_records(id) DEFERRABLE INITIALLY DEFERRED,
 dead_at double precision, record jsonb NOT NULL,
 CHECK(mother_id IS NULL OR mother_id<>id),
 CHECK(father_id IS NULL OR father_id<>id),
 CHECK(dead_at IS NULL OR dead_at>=born_at)
);
CREATE INDEX IF NOT EXISTS rat_memorial_page ON rat_records(id) WHERE dead_at IS NOT NULL;
CREATE TABLE IF NOT EXISTS care_intents (
 id uuid PRIMARY KEY, wallet text NOT NULL, rat_id text NOT NULL REFERENCES rat_records(id),
 request_id uuid NOT NULL, action text NOT NULL, name text,
 cost integer NOT NULL CHECK(cost>=0), units numeric(78,0) NOT NULL CHECK(units>=0),
 chain_id integer NOT NULL CHECK(chain_id=46630), token text NOT NULL,
 created_at bigint NOT NULL, expires_at bigint NOT NULL,
 status text NOT NULL DEFAULT 'reserved' CHECK(status IN ('reserved','applied','review')),
 UNIQUE(wallet,request_id), CHECK(expires_at>created_at)
);
-- Expired reservations deliberately stay held pending reconciliation:
-- a burn cannot be undone just because the app's timer expired.
CREATE UNIQUE INDEX IF NOT EXISTS one_open_intent_per_rat ON care_intents(rat_id) WHERE status IN ('reserved','review');
CREATE TABLE IF NOT EXISTS rat_ownership (
 rat_id text PRIMARY KEY REFERENCES rat_records(id),
 wallet text NOT NULL,
 mint_intent uuid UNIQUE NOT NULL REFERENCES care_intents(id)
);
CREATE TABLE IF NOT EXISTS burn_receipts (
 receipt_key text PRIMARY KEY, intent_id uuid UNIQUE NOT NULL REFERENCES care_intents(id),
 chain_id integer NOT NULL, token text NOT NULL, tx_hash text NOT NULL,
 evidence jsonb NOT NULL, UNIQUE(chain_id,token,tx_hash)
);
CREATE TABLE IF NOT EXISTS care_events (
 id bigserial PRIMARY KEY, intent_id uuid UNIQUE NOT NULL REFERENCES care_intents(id),
 event jsonb NOT NULL, created_at bigint NOT NULL
);
CREATE TABLE IF NOT EXISTS rate_windows (
 bucket text PRIMARY KEY, hits integer NOT NULL, expires_at bigint NOT NULL
);
