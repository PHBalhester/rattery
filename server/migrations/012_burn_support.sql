-- Confirmed ERC20 burns collected alongside trades; no browser writes.
CREATE TABLE colony_burns (
 identity text PRIMARY KEY,
 block_number bigint NOT NULL REFERENCES trade_blocks(block_number),
 log_index integer NOT NULL CHECK(log_index>=0),
 raw jsonb NOT NULL,
 available_at bigint NOT NULL,
 applied_tick bigint,
 applied_at bigint,
 effect jsonb,
 UNIQUE(block_number,log_index),
 CHECK((applied_tick IS NULL)=(applied_at IS NULL)),
 CHECK((applied_tick IS NULL)=(effect IS NULL))
);
CREATE INDEX colony_burns_queue ON colony_burns(block_number,log_index) WHERE applied_tick IS NULL;
