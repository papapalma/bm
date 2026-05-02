-- ==========================================
-- Pending Trainee Registrations Table
-- Run this in your Supabase SQL editor
-- ==========================================

CREATE TABLE IF NOT EXISTS pending_registrations (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Account credentials
  username      VARCHAR(100) NOT NULL,
  email         VARCHAR(255) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,

  -- Personal info (mirrors trainees table)
  first_name    VARCHAR(100) NOT NULL,
  last_name     VARCHAR(100) NOT NULL,
  middle_name   VARCHAR(100) NOT NULL DEFAULT '',
  phone         VARCHAR(20)  NOT NULL,
  sex           VARCHAR(10)  NOT NULL,
  birth_date    DATE         NOT NULL,
  birth_place   VARCHAR(255) NOT NULL,
  civil_status  VARCHAR(20)  NOT NULL,

  -- Address
  province      VARCHAR(100) NOT NULL,
  municipality  VARCHAR(100) NOT NULL,
  barangay      VARCHAR(100) NOT NULL,
  street        TEXT         NOT NULL,

  -- Education & Employment
  educational_attainment VARCHAR(50) NOT NULL,
  course        VARCHAR(255) NOT NULL,
  year_graduated VARCHAR(4)  NOT NULL,
  classification VARCHAR(50) NOT NULL,
  disability    VARCHAR(255) NULL,
  employment_status VARCHAR(30) NOT NULL,

  -- Program enrollment request
  program_id    UUID         NOT NULL REFERENCES programs(id) ON DELETE CASCADE,

  -- Review workflow
  status        VARCHAR(20)  NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'approved', 'rejected')),
  rejection_reason TEXT NULL,
  reviewed_by   UUID         NULL REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at   TIMESTAMPTZ  NULL,

  created_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- Index for fast pending lookups
CREATE INDEX IF NOT EXISTS idx_pending_registrations_status  ON pending_registrations(status);
CREATE INDEX IF NOT EXISTS idx_pending_registrations_email   ON pending_registrations(email);
CREATE INDEX IF NOT EXISTS idx_pending_registrations_program ON pending_registrations(program_id);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_pending_registrations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_pending_registrations_updated_at ON pending_registrations;
CREATE TRIGGER trg_pending_registrations_updated_at
  BEFORE UPDATE ON pending_registrations
  FOR EACH ROW EXECUTE FUNCTION update_pending_registrations_updated_at();

-- RLS: allow public INSERT (self-registration), restrict SELECT/UPDATE to authenticated staff
ALTER TABLE pending_registrations ENABLE ROW LEVEL SECURITY;

-- Anyone can submit a registration
CREATE POLICY "public_insert_registration"
  ON pending_registrations FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Only authenticated users (staff/admin) can view registrations
CREATE POLICY "staff_view_registrations"
  ON pending_registrations FOR SELECT
  TO authenticated
  USING (true);

-- Only authenticated users can update (approve/reject)
CREATE POLICY "staff_update_registrations"
  ON pending_registrations FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);
