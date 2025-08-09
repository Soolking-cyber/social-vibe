-- Create verification_sessions table for two-phase job completion
CREATE TABLE IF NOT EXISTS verification_sessions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    job_id INTEGER NOT NULL,
    tweet_id TEXT NOT NULL,
    action_type TEXT NOT NULL,
    before_counts JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    
    -- Ensure one verification session per user per job
    UNIQUE(user_id, job_id)
);

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_verification_sessions_user_job ON verification_sessions(user_id, job_id);
CREATE INDEX IF NOT EXISTS idx_verification_sessions_expires ON verification_sessions(expires_at);

-- Add cleanup function to remove expired sessions
CREATE OR REPLACE FUNCTION cleanup_expired_verification_sessions()
RETURNS void AS $$
BEGIN
    DELETE FROM verification_sessions WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- Optional: Create a scheduled job to clean up expired sessions (if using pg_cron)
-- SELECT cron.schedule('cleanup-verification-sessions', '*/5 * * * *', 'SELECT cleanup_expired_verification_sessions();');