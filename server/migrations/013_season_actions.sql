BEGIN;
CREATE TABLE IF NOT EXISTS season_quotes(quote_hash text PRIMARY KEY,wallet text NOT NULL,nonce numeric(78,0) NOT NULL,quote jsonb NOT NULL,signature text NOT NULL,price jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS season_actions(event_key text PRIMARY KEY,tx_hash text NOT NULL UNIQUE,wallet text NOT NULL,block_number bigint NOT NULL,block_hash text NOT NULL,receipt jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS season_colony_ticks(season text NOT NULL,slot integer NOT NULL,due_at bigint NOT NULL,observation jsonb NOT NULL,deltas jsonb NOT NULL,raw_tx text,tx_hash text,confirmed boolean NOT NULL DEFAULT false,created_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(season,slot));
COMMIT;