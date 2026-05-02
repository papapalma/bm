-- Migration: Auth recovery tables for refresh tokens and admin-assisted password reset
-- Safe to run multiple times.

-- Refresh tokens (opaque token hashes, rotating refresh model)
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  last_used_at TIMESTAMPTZ,
  created_ip VARCHAR(45),
  created_user_agent TEXT,
  rotated_from UUID REFERENCES refresh_tokens(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires_at ON refresh_tokens(expires_at);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_revoked_at ON refresh_tokens(revoked_at);

ALTER TABLE refresh_tokens ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'refresh_tokens' AND policyname = 'service_role_only_refresh_tokens'
  ) THEN
    CREATE POLICY "service_role_only_refresh_tokens" ON refresh_tokens
      USING (false)
      WITH CHECK (false);
  END IF;
END
$$;

-- Admin-assisted password reset requests
CREATE TABLE IF NOT EXISTS password_reset_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  request_email VARCHAR(255) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'completed', 'rejected')),
  request_notes TEXT,
  approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  reset_token_hash TEXT UNIQUE,
  token_expires_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_ip VARCHAR(45),
  created_user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_password_reset_requests_user_id ON password_reset_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_password_reset_requests_status ON password_reset_requests(status);
CREATE INDEX IF NOT EXISTS idx_password_reset_requests_created_at ON password_reset_requests(created_at);
CREATE INDEX IF NOT EXISTS idx_password_reset_requests_token_expires_at ON password_reset_requests(token_expires_at);

ALTER TABLE password_reset_requests ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'password_reset_requests' AND policyname = 'service_role_only_password_reset_requests'
  ) THEN
    CREATE POLICY "service_role_only_password_reset_requests" ON password_reset_requests
      USING (false)
      WITH CHECK (false);
  END IF;
END
$$;

-- Optional housekeeping function
CREATE OR REPLACE FUNCTION purge_expired_auth_recovery_data()
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  DELETE FROM refresh_tokens WHERE expires_at < NOW() OR (revoked_at IS NOT NULL AND revoked_at < NOW() - INTERVAL '30 days');
  DELETE FROM password_reset_requests WHERE status IN ('completed', 'rejected') AND updated_at < NOW() - INTERVAL '30 days';
END;
$$;
