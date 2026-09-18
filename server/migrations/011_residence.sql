CREATE TABLE IF NOT EXISTS holder_residence (
 wallet text PRIMARY KEY CHECK(wallet ~ '^0x[0-9a-f]{40}$'),
 verified_ms bigint NOT NULL DEFAULT 0 CHECK(verified_ms>=0),
 checked_at bigint NOT NULL DEFAULT 0,
 block_number bigint NOT NULL DEFAULT 0,
 block_hash text,
 balance_units numeric(78,0), value_micros numeric(78,0),
 eligible boolean NOT NULL DEFAULT false,
 status text NOT NULL DEFAULT 'pending', evidence jsonb
);
CREATE TABLE IF NOT EXISTS holder_residence_history (
 id bigserial PRIMARY KEY,wallet text NOT NULL, recorded_at bigint NOT NULL,
 kind text NOT NULL,evidence jsonb NOT NULL
);

CREATE OR REPLACE VIEW residence_wallets AS SELECT DISTINCT wallet FROM auth_sessions;
