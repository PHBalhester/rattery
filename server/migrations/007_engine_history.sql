-- Operator-owned transition audit. No grants to runtime or public observer roles.
CREATE TABLE IF NOT EXISTS colony_engine_history (
 transition_id text PRIMARY KEY,
 from_version text NOT NULL,
 to_version text NOT NULL,
 simulation_tick bigint NOT NULL,
 simulation_at bigint,
 revision bigint NOT NULL,
 world jsonb NOT NULL,
 recorded_at timestamptz NOT NULL DEFAULT now()
);
