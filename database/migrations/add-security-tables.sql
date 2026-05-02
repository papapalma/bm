-- Migration: Security hardening tables
-- Run this migration before deploying SEC-4/5 fixes.

-- ─────────────────────────────────────────────────────────────────────────────
-- JWT Denylist (revoked tokens)
-- Each row records the jti of a revoked JWT so logout truly invalidates a token.
-- The row is safe to purge once expires_at is in the past.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS revoked_tokens (
  jti         TEXT        PRIMARY KEY,
  expires_at  TIMESTAMPTZ NOT NULL,
  revoked_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast lookup and for the cleanup job
CREATE INDEX IF NOT EXISTS idx_revoked_tokens_expires_at ON revoked_tokens (expires_at);

-- Row Level Security — service role only, never the anon key
ALTER TABLE revoked_tokens ENABLE ROW LEVEL SECURITY;

-- No public SELECT/INSERT/DELETE — only the service-role key (used by the API)
-- may touch this table.
CREATE POLICY "service_role_only" ON revoked_tokens
  USING (false)
  WITH CHECK (false);

-- ─────────────────────────────────────────────────────────────────────────────
-- Cleanup function: remove expired revoked tokens (call periodically via cron)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION purge_expired_revoked_tokens()
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  DELETE FROM revoked_tokens WHERE expires_at < NOW();
END;
$$;
