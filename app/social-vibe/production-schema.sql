-- =====================================================
-- SOCIAL IMPACT PLATFORM - PRODUCTION DATABASE SCHEMA
-- =====================================================
-- This file contains the complete database schema for the Social Impact platform
-- Run this file on a fresh database to set up all required tables and indexes

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- NEXT AUTH SCHEMA AND TABLES
-- =====================================================

-- Create next_auth schema
CREATE SCHEMA IF NOT EXISTS next_auth;
GRANT USAGE ON SCHEMA next_auth TO service_role;
GRANT ALL ON SCHEMA next_auth TO postgres;

-- NextAuth users table
CREATE TABLE IF NOT EXISTS next_auth.users(
    id uuid NOT NULL DEFAULT uuid_generate_v4(),
    name text,
    email text,
    "emailVerified" timestamp with time zone,
    image text,
    balance DECIMAL(10,3) DEFAULT 0.00,
    CONSTRAINT users_pkey PRIMARY KEY (id),
    CONSTRAINT email_unique UNIQUE (email)
);

GRANT ALL ON TABLE next_auth.users TO postgres;
GRANT ALL ON TABLE next_auth.users TO service_role;

-- NextAuth sessions table
CREATE TABLE IF NOT EXISTS next_auth.sessions(
    id uuid NOT NULL DEFAULT uuid_generate_v4(),
    expires timestamp with time zone NOT NULL,
    "sessionToken" text NOT NULL,
    "userId" uuid,
    CONSTRAINT sessions_pkey PRIMARY KEY (id),
    CONSTRAINT sessionToken_unique UNIQUE ("sessionToken"),
    CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId")
        REFERENCES next_auth.users (id) MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE CASCADE
);

GRANT ALL ON TABLE next_auth.sessions TO postgres;
GRANT ALL ON TABLE next_auth.sessions TO service_role;

-- NextAuth accounts table
CREATE TABLE IF NOT EXISTS next_auth.accounts(
    id uuid NOT NULL DEFAULT uuid_generate_v4(),
    type text NOT NULL,
    provider text NOT NULL,
    "providerAccountId" text NOT NULL,
    refresh_token text,
    access_token text,
    expires_at bigint,
    token_type text,
    scope text,
    id_token text,
    session_state text,
    oauth_token_secret text,
    oauth_token text,
    "userId" uuid,
    CONSTRAINT accounts_pkey PRIMARY KEY (id),
    CONSTRAINT provider_unique UNIQUE (provider, "providerAccountId"),
    CONSTRAINT "accounts_userId_fkey" FOREIGN KEY ("userId")
        REFERENCES next_auth.users (id) MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE CASCADE
);

GRANT ALL ON TABLE next_auth.accounts TO postgres;
GRANT ALL ON TABLE next_auth.accounts TO service_role;

-- NextAuth verification tokens table
CREATE TABLE IF NOT EXISTS next_auth.verification_tokens(
    identifier text,
    token text,
    expires timestamp with time zone NOT NULL,
    CONSTRAINT verification_tokens_pkey PRIMARY KEY (token),
    CONSTRAINT token_unique UNIQUE (token),
    CONSTRAINT token_identifier_unique UNIQUE (token, identifier)
);

GRANT ALL ON TABLE next_auth.verification_tokens TO postgres;
GRANT ALL ON TABLE next_auth.verification_tokens TO service_role;

-- NextAuth utility function
CREATE OR REPLACE FUNCTION next_auth.uid() RETURNS uuid
    LANGUAGE sql STABLE
    AS $$
  select
  	coalesce(
		nullif(current_setting('request.jwt.claim.sub', true), ''),
		(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
	)::uuid
$$;

-- =====================================================
-- PUBLIC SCHEMA - MAIN APPLICATION TABLES
-- =====================================================

-- Main users table for the application
CREATE TABLE IF NOT EXISTS public.users (
    id uuid NOT NULL DEFAULT uuid_generate_v4(),
    email text,
    name text,
    image text,
    twitter_handle text,
    balance DECIMAL(10,3) DEFAULT 0.00,
    wallet_address text,
    wallet_private_key text, -- Encrypted
    wallet_mnemonic text, -- Encrypted
    eth_balance DECIMAL(18,8) DEFAULT 0.00000000,
    usdc_balance DECIMAL(18,6) DEFAULT 0.000000,
    last_balance_update timestamp with time zone DEFAULT now(),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT public_users_pkey PRIMARY KEY (id),
    CONSTRAINT public_users_name_unique UNIQUE (name) DEFERRABLE INITIALLY DEFERRED
);

-- Create conditional unique constraint for email (only for non-null emails)
CREATE UNIQUE INDEX IF NOT EXISTS public_users_email_unique ON public.users (email) WHERE email IS NOT NULL;

-- Create unique index on wallet address
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_wallet_address ON public.users(wallet_address) WHERE wallet_address IS NOT NULL;

GRANT ALL ON TABLE public.users TO postgres;
GRANT ALL ON TABLE public.users TO service_role;

-- Jobs table for Social Impact platform
CREATE TABLE IF NOT EXISTS jobs (
    id uuid NOT NULL DEFAULT uuid_generate_v4(),
    user_id uuid NOT NULL,
    tweet_url text NOT NULL,
    action_type text NOT NULL CHECK (action_type IN ('like', 'repost', 'comment')),
    price_per_action DECIMAL(10,3) NOT NULL,
    max_actions INTEGER NOT NULL,
    total_budget DECIMAL(10,2) NOT NULL,
    platform_fee DECIMAL(10,2) NOT NULL,
    completed_actions INTEGER DEFAULT 0,
    comment_text text,
    status text DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed')),
    contract_job_id integer,
    transaction_hash text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT jobs_pkey PRIMARY KEY (id),
    CONSTRAINT jobs_user_id_fkey FOREIGN KEY (user_id)
        REFERENCES public.users (id) MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE CASCADE
);

GRANT ALL ON TABLE jobs TO postgres;
GRANT ALL ON TABLE jobs TO service_role;

-- Job completions table to track user job completions
CREATE TABLE IF NOT EXISTS job_completions (
    id uuid NOT NULL DEFAULT uuid_generate_v4(),
    job_id integer NOT NULL,
    user_id uuid NOT NULL,
    reward_amount DECIMAL(18,6) NOT NULL,
    completed_at timestamp with time zone DEFAULT now(),
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT job_completions_pkey PRIMARY KEY (id),
    CONSTRAINT job_completions_user_id_fkey FOREIGN KEY (user_id)
        REFERENCES public.users (id) MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE CASCADE,
    CONSTRAINT job_completions_unique_user_job UNIQUE (job_id, user_id)
);

GRANT ALL ON TABLE job_completions TO postgres;
GRANT ALL ON TABLE job_completions TO service_role;

-- Wallet transactions table for on-chain transaction tracking
CREATE TABLE IF NOT EXISTS wallet_transactions (
    id uuid NOT NULL DEFAULT uuid_generate_v4(),
    user_id uuid NOT NULL,
    transaction_hash text NOT NULL,
    transaction_type text NOT NULL CHECK (transaction_type IN ('deposit', 'withdrawal', 'payment', 'gas', 'job_creation', 'job_completion', 'earnings_withdrawal')),
    token_type text NOT NULL CHECK (token_type IN ('ETH', 'USDC')),
    amount DECIMAL(18,8) NOT NULL,
    from_address text NOT NULL,
    to_address text NOT NULL,
    gas_used DECIMAL(18,8),
    gas_price DECIMAL(18,8),
    block_number bigint,
    status text DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'failed', 'cancelled')),
    created_at timestamp with time zone DEFAULT now(),
    confirmed_at timestamp with time zone,
    CONSTRAINT wallet_transactions_pkey PRIMARY KEY (id),
    CONSTRAINT wallet_transactions_user_id_fkey FOREIGN KEY (user_id)
        REFERENCES public.users (id) MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE CASCADE,
    CONSTRAINT wallet_transactions_hash_unique UNIQUE (transaction_hash)
);

GRANT ALL ON TABLE wallet_transactions TO postgres;
GRANT ALL ON TABLE wallet_transactions TO service_role;

-- Legacy transactions table (kept for compatibility)
CREATE TABLE IF NOT EXISTS transactions (
    id uuid NOT NULL DEFAULT uuid_generate_v4(),
    user_id uuid NOT NULL,
    type text NOT NULL CHECK (type IN ('job_creation', 'job_completion', 'deposit', 'withdrawal')),
    amount DECIMAL(10,3) NOT NULL,
    description text,
    job_id uuid,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT transactions_pkey PRIMARY KEY (id),
    CONSTRAINT transactions_user_id_fkey FOREIGN KEY (user_id)
        REFERENCES public.users (id) MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE CASCADE,
    CONSTRAINT transactions_job_id_fkey FOREIGN KEY (job_id)
        REFERENCES jobs (id) MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE SET NULL
);

GRANT ALL ON TABLE transactions TO postgres;
GRANT ALL ON TABLE transactions TO service_role;

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================

-- Users table indexes
CREATE INDEX IF NOT EXISTS idx_public_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_public_users_created_at ON public.users(created_at);
CREATE INDEX IF NOT EXISTS idx_public_users_twitter_handle ON public.users(twitter_handle);


-- Jobs table indexes
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_user_id ON jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_jobs_created_at ON jobs(created_at);
CREATE INDEX IF NOT EXISTS idx_jobs_contract_job_id ON jobs(contract_job_id);
CREATE INDEX IF NOT EXISTS idx_jobs_transaction_hash ON jobs(transaction_hash);

-- Job completions indexes
CREATE INDEX IF NOT EXISTS idx_job_completions_job_id ON job_completions(job_id);
CREATE INDEX IF NOT EXISTS idx_job_completions_user_id ON job_completions(user_id);
CREATE INDEX IF NOT EXISTS idx_job_completions_completed_at ON job_completions(completed_at);

-- Wallet transactions indexes
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_user_id ON wallet_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_hash ON wallet_transactions(transaction_hash);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_status ON wallet_transactions(status);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_created_at ON wallet_transactions(created_at);

-- Legacy transactions indexes
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at);

-- =====================================================
-- FUNCTIONS AND TRIGGERS
-- =====================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to automatically update updated_at for jobs
CREATE TRIGGER update_jobs_updated_at BEFORE UPDATE ON jobs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- INITIAL DATA SETUP
-- =====================================================

-- Note: earned_balance is now calculated dynamically from job_completions table

-- =====================================================
-- COMMENTS FOR DOCUMENTATION
-- =====================================================

COMMENT ON SCHEMA next_auth IS 'NextAuth.js authentication schema';
COMMENT ON TABLE public.users IS 'Main users table with wallet and Twitter integration';
COMMENT ON TABLE jobs IS 'Social media engagement jobs created by users';
COMMENT ON TABLE job_completions IS 'Tracks which users completed which jobs';
COMMENT ON TABLE wallet_transactions IS 'On-chain transaction tracking for wallets';
COMMENT ON TABLE transactions IS 'Legacy transaction tracking (kept for compatibility)';

COMMENT ON COLUMN public.users.twitter_handle IS 'Twitter username for verification (without @)';
COMMENT ON COLUMN public.users.wallet_address IS 'Ethereum wallet address';
COMMENT ON COLUMN public.users.wallet_private_key IS 'Encrypted private key';
COMMENT ON COLUMN public.users.wallet_mnemonic IS 'Encrypted mnemonic phrase';
-- earned_balance is now calculated dynamically from job_completions table
COMMENT ON COLUMN public.users.eth_balance IS 'ETH balance in wallet';
COMMENT ON COLUMN public.users.usdc_balance IS 'USDC balance in wallet';

COMMENT ON COLUMN jobs.contract_job_id IS 'Job ID from the smart contract';
COMMENT ON COLUMN jobs.transaction_hash IS 'Transaction hash of job creation';
COMMENT ON COLUMN job_completions.job_id IS 'References contract_job_id from jobs table';

-- =====================================================
-- SECURITY NOTES
-- =====================================================

-- IMPORTANT SECURITY CONSIDERATIONS:
-- 1. wallet_private_key and wallet_mnemonic columns contain encrypted data
-- 2. Ensure proper encryption/decryption in application layer
-- 3. Consider using database-level encryption for sensitive columns
-- 4. Implement proper RLS (Row Level Security) policies for production
-- 5. Regularly rotate encryption keys
-- 6. Monitor access to sensitive wallet data

-- =====================================================
-- SCHEMA VERSION AND METADATA
-- =====================================================

-- Create a metadata table to track schema version
CREATE TABLE IF NOT EXISTS schema_metadata (
    key text PRIMARY KEY,
    value text NOT NULL,
    updated_at timestamp with time zone DEFAULT now()
);

INSERT INTO schema_metadata (key, value) VALUES 
    ('schema_version', '1.0.0'),
    ('created_at', now()::text),
    ('description', 'Social Impact Platform - Complete Production Schema')
ON CONFLICT (key) DO UPDATE SET 
    value = EXCLUDED.value,
    updated_at = now();

GRANT ALL ON TABLE schema_metadata TO postgres;
GRANT ALL ON TABLE schema_metadata TO service_role;

-- =====================================================
-- END OF SCHEMA
-- =====================================================

-- Schema setup complete!
-- This schema includes:
-- ✅ NextAuth.js authentication tables
-- ✅ User management with wallet integration
-- ✅ Twitter handle verification support
-- ✅ Job creation and completion tracking
-- ✅ On-chain transaction tracking
-- ✅ Comprehensive indexing for performance
-- ✅ Security considerations and documentation
-- ✅ Version tracking and metadata