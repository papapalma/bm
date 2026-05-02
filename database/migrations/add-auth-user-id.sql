-- Migration: Add Supabase Auth identity mapping to users
-- Purpose: Link application users to Supabase Auth users via auth_user_id
-- Safe to run multiple times.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS auth_user_id UUID;

-- Unique mapping: one app user <-> one Supabase auth user
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_auth_user_id_unique
  ON users (auth_user_id)
  WHERE auth_user_id IS NOT NULL;

-- Optional helper index for migration/backfill operations by email
CREATE INDEX IF NOT EXISTS idx_users_email_lower
  ON users (LOWER(email));
