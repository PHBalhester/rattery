-- A single configured market drives one colony. These are operator-only tables.
CREATE TABLE trade_stream (
 id integer PRIMARY KEY CHECK(id=1),
 chain_id integer NOT NULL CHECK(chain_id IN (4663,46630)),
 token text NOT NULL,
 last_block bigint NOT NULL CHECK(last_block>=0),
 last_hash text NOT NULL,
 last_timestamp bigint NOT NULL,
 halted boolean NOT NULL DEFAULT false
);
CREATE TABLE trade_blocks (
 block_number bigint PRIMARY KEY,
 block_hash text NOT NULL,
 fingerprint text NOT NULL
);
CREATE TABLE colony_trades (
 identity text PRIMARY KEY,
 block_number bigint NOT NULL REFERENCES trade_blocks(block_number),
 log_index integer NOT NULL CHECK(log_index>=0),
 raw jsonb NOT NULL,
 valuation jsonb NOT NULL,
 status text NOT NULL CHECK(status IN ('pending','ready','applied')),
 available_at bigint NOT NULL,
 applied_tick bigint,
 applied_at bigint,
 UNIQUE(block_number,log_index),
 CHECK((status='applied')=(applied_tick IS NOT NULL AND applied_at IS NOT NULL))
);
CREATE INDEX colony_trades_queue ON colony_trades(block_number,log_index) WHERE status<>'applied';
