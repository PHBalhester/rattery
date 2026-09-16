ALTER TABLE colony_state ADD COLUMN IF NOT EXISTS simulation_tick bigint NOT NULL DEFAULT 0;
ALTER TABLE colony_state ADD COLUMN IF NOT EXISTS simulation_at bigint;
ALTER TABLE colony_state ADD COLUMN IF NOT EXISTS engine_version text;
