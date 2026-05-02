-- Migration: Add report scheduling persistence

CREATE TABLE IF NOT EXISTS report_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_type VARCHAR(100) NOT NULL,
  frequency VARCHAR(20) NOT NULL CHECK (frequency IN ('daily', 'weekly', 'monthly')),
  recipients JSONB NOT NULL DEFAULT '[]'::jsonb,
  format VARCHAR(10) NOT NULL CHECK (format IN ('pdf', 'csv')),
  filters JSONB,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  status VARCHAR(20) NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'paused', 'failed')),
  execution_strategy VARCHAR(100) NOT NULL DEFAULT 'db-cron-worker',
  last_run_at TIMESTAMP,
  next_run_at TIMESTAMP NOT NULL,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_report_schedules_next_run_at ON report_schedules(next_run_at);
CREATE INDEX IF NOT EXISTS idx_report_schedules_status ON report_schedules(status);
CREATE INDEX IF NOT EXISTS idx_report_schedules_is_active ON report_schedules(is_active);

ALTER TABLE report_schedules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view report schedules" ON report_schedules;
CREATE POLICY "Authenticated users can view report schedules"
  ON report_schedules FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Admin and staff can manage report schedules" ON report_schedules;
CREATE POLICY "Admin and staff can manage report schedules"
  ON report_schedules FOR ALL
  USING (true)
  WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON report_schedules TO authenticated;
GRANT ALL ON report_schedules TO service_role;

DROP TRIGGER IF EXISTS update_report_schedules_updated_at ON report_schedules;
CREATE TRIGGER update_report_schedules_updated_at
  BEFORE UPDATE ON report_schedules
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
