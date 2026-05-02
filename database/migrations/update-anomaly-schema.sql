-- Migration: Align anomaly severity and status values to match frontend types
-- Run this against your Supabase database BEFORE deploying the updated backend

-- ── Step 1: Migrate severity values ─────────────────────────────────────────
-- Drop the old CHECK constraint (PostgreSQL auto-names it based on table+column)
ALTER TABLE anomalies DROP CONSTRAINT IF EXISTS anomalies_severity_check;

-- Map old → new values
UPDATE anomalies SET severity = CASE
  WHEN severity = 'high'   THEN 'critical'
  WHEN severity = 'medium' THEN 'warning'
  WHEN severity = 'low'    THEN 'info'
  ELSE severity  -- 'critical' stays as-is
END;

-- Add the new CHECK constraint
ALTER TABLE anomalies
  ADD CONSTRAINT anomalies_severity_check CHECK (severity IN ('critical', 'warning', 'info'));

-- ── Step 2: Migrate status values ────────────────────────────────────────────
ALTER TABLE anomalies DROP CONSTRAINT IF EXISTS anomalies_status_check;

UPDATE anomalies SET status = CASE
  WHEN status = 'pending'       THEN 'open'
  WHEN status = 'investigating' THEN 'in_progress'
  ELSE status  -- 'resolved' and 'dismissed' stay as-is
END;

-- Also fix the column DEFAULT
ALTER TABLE anomalies ALTER COLUMN status SET DEFAULT 'open';

ALTER TABLE anomalies
  ADD CONSTRAINT anomalies_status_check CHECK (status IN ('open', 'in_progress', 'resolved', 'dismissed'));

-- ── Step 3: Add new columns (skip if already present) ────────────────────────
ALTER TABLE anomalies
  ADD COLUMN IF NOT EXISTS category VARCHAR(50) NOT NULL DEFAULT 'system',
  ADD COLUMN IF NOT EXISTS anomaly_type VARCHAR(100) NOT NULL DEFAULT 'system_alert',
  ADD COLUMN IF NOT EXISTS recommendation TEXT,
  ADD COLUMN IF NOT EXISTS detection_logic TEXT,
  ADD COLUMN IF NOT EXISTS entity_type VARCHAR(100),
  ADD COLUMN IF NOT EXISTS entity_id UUID,
  ADD COLUMN IF NOT EXISTS entity_identifier VARCHAR(255),
  ADD COLUMN IF NOT EXISTS metadata JSONB,
  ADD COLUMN IF NOT EXISTS auto_resolved BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS occurrence_count INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS first_occurrence_at TIMESTAMP DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS last_occurrence_at TIMESTAMP DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS detection_run_id VARCHAR(100);

-- ── Step 4: Migrate legacy "type" column to new category+anomaly_type ─────────
-- Map type → category
UPDATE anomalies SET category = CASE
  WHEN type IN ('quantity_mismatch', 'damaged_item', 'lost_item') THEN 'inventory'
  WHEN type = 'overdue' THEN 'lending'
  WHEN type = 'unauthorized_access' THEN 'system'
  WHEN type = 'system_alert' THEN 'system'
  ELSE 'system'
END
WHERE category = 'system';

-- Copy type → anomaly_type
UPDATE anomalies SET anomaly_type = type WHERE anomaly_type = 'system_alert';

-- ── Step 5: Add CHECK constraint on category ──────────────────────────────────
ALTER TABLE anomalies DROP CONSTRAINT IF EXISTS anomalies_category_check;
ALTER TABLE anomalies
  ADD CONSTRAINT anomalies_category_check
    CHECK (category IN ('trainee', 'inventory', 'lending', 'program', 'activity_log', 'system'));

-- ── Step 6: Add new indexes ───────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_anomalies_category     ON anomalies(category);
CREATE INDEX IF NOT EXISTS idx_anomalies_anomaly_type ON anomalies(anomaly_type);
CREATE INDEX IF NOT EXISTS idx_anomalies_entity        ON anomalies(entity_type, entity_id);

-- ── Step 7: Optional — drop legacy "type" column ──────────────────────────────
-- Uncomment only after confirming the new columns are working correctly:
-- ALTER TABLE anomalies DROP COLUMN IF EXISTS type;
-- ALTER TABLE anomalies DROP COLUMN IF EXISTS lending_id;

