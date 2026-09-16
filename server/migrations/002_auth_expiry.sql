ALTER TABLE auth_challenges ADD COLUMN IF NOT EXISTS browser_digest text;
CREATE INDEX IF NOT EXISTS auth_challenge_expiry ON auth_challenges(expires_at);
CREATE INDEX IF NOT EXISTS auth_session_expiry ON auth_sessions(expires_at);
CREATE INDEX IF NOT EXISTS rate_window_expiry ON rate_windows(expires_at);
