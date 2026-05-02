-- Migration: Allow external (non-trainee) borrowers
-- Run this against your Supabase database

-- 1. Make trainee_id nullable
ALTER TABLE lendings
  ALTER COLUMN trainee_id DROP NOT NULL;

-- 2. Add borrower fields for non-trainees
ALTER TABLE lendings
  ADD COLUMN IF NOT EXISTS borrower_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS borrower_contact VARCHAR(100);

-- 3. Ensure at least one borrower identifier is always present
ALTER TABLE lendings
  DROP CONSTRAINT IF EXISTS lending_borrower_check;

ALTER TABLE lendings
  ADD CONSTRAINT lending_borrower_check
  CHECK (trainee_id IS NOT NULL OR borrower_name IS NOT NULL);
