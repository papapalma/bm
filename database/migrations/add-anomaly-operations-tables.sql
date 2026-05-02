-- Migration: Add anomaly detection configuration and run history tables

CREATE TABLE IF NOT EXISTS anomaly_detection_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_key VARCHAR(100) NOT NULL UNIQUE,
  config_value JSONB NOT NULL DEFAULT '{}'::jsonb,
  description TEXT,
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_by VARCHAR(255) NOT NULL DEFAULT 'system',
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS anomaly_detection_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at TIMESTAMP NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMP,
  duration_seconds INTEGER,
  total_anomalies_found INTEGER NOT NULL DEFAULT 0,
  critical_count INTEGER NOT NULL DEFAULT 0,
  warning_count INTEGER NOT NULL DEFAULT 0,
  info_count INTEGER NOT NULL DEFAULT 0,
  trigger_type VARCHAR(20) NOT NULL CHECK (trigger_type IN ('scheduled', 'manual')),
  triggered_by VARCHAR(255),
  status VARCHAR(20) NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed')),
  error_message TEXT,
  config_snapshot JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_anomaly_detection_runs_started_at ON anomaly_detection_runs(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_anomaly_detection_runs_status ON anomaly_detection_runs(status);
CREATE INDEX IF NOT EXISTS idx_anomaly_detection_runs_trigger_type ON anomaly_detection_runs(trigger_type);
CREATE INDEX IF NOT EXISTS idx_anomalies_detection_run_id ON anomalies(detection_run_id);

ALTER TABLE anomaly_detection_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE anomaly_detection_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view anomaly detection configs" ON anomaly_detection_configs;
CREATE POLICY "Authenticated users can view anomaly detection configs"
  ON anomaly_detection_configs FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Admin and staff can manage anomaly detection configs" ON anomaly_detection_configs;
CREATE POLICY "Admin and staff can manage anomaly detection configs"
  ON anomaly_detection_configs FOR ALL
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can view anomaly detection runs" ON anomaly_detection_runs;
CREATE POLICY "Authenticated users can view anomaly detection runs"
  ON anomaly_detection_runs FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Admin and staff can manage anomaly detection runs" ON anomaly_detection_runs;
CREATE POLICY "Admin and staff can manage anomaly detection runs"
  ON anomaly_detection_runs FOR ALL
  USING (true)
  WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON anomaly_detection_configs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON anomaly_detection_runs TO authenticated;
GRANT ALL ON anomaly_detection_configs TO service_role;
GRANT ALL ON anomaly_detection_runs TO service_role;

INSERT INTO anomaly_detection_configs (config_key, config_value, description, updated_by)
VALUES (
  'default',
  '{
    "enabled_checks": {
      "quantity_discrepancy": true,
      "overdue_lending": true,
      "name_email_mismatch": false,
      "impossible_availability": true,
      "zero_quantity_lending": true,
      "active_trainee_without_program": true,
      "expired_active_program": true,
      "lending_inactive_trainee": true,
      "minimum_quantity_unset": true
    },
    "thresholds": {
      "quantity_discrepancy_warning_ratio": 0.1,
      "quantity_discrepancy_critical_ratio": 0.3,
      "overdue_warning_days": 3,
      "overdue_critical_days": 7
    },
    "auto_resolve": {
      "enabled": true,
      "max_days": 14
    }
  }'::jsonb,
  'Default anomaly detection settings',
  'system'
)
ON CONFLICT (config_key) DO NOTHING;

-- Backfill missing keys while preserving any explicit user overrides.
UPDATE anomaly_detection_configs
SET config_value = jsonb_build_object(
  'enabled_checks',
    '{
      "quantity_discrepancy": true,
      "overdue_lending": true,
      "name_email_mismatch": false,
      "impossible_availability": true,
      "zero_quantity_lending": true,
      "active_trainee_without_program": true,
      "expired_active_program": true,
      "lending_inactive_trainee": true,
      "minimum_quantity_unset": true
    }'::jsonb || COALESCE(config_value->'enabled_checks', '{}'::jsonb),
  'thresholds',
    '{
      "quantity_discrepancy_warning_ratio": 0.1,
      "quantity_discrepancy_critical_ratio": 0.3,
      "overdue_warning_days": 3,
      "overdue_critical_days": 7
    }'::jsonb || COALESCE(config_value->'thresholds', '{}'::jsonb),
  'auto_resolve',
    '{
      "enabled": true,
      "max_days": 14
    }'::jsonb || COALESCE(config_value->'auto_resolve', '{}'::jsonb)
)
WHERE config_key = 'default';

DROP TRIGGER IF EXISTS update_anomaly_detection_configs_updated_at ON anomaly_detection_configs;
CREATE TRIGGER update_anomaly_detection_configs_updated_at
  BEFORE UPDATE ON anomaly_detection_configs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_anomaly_detection_runs_updated_at ON anomaly_detection_runs;
CREATE TRIGGER update_anomaly_detection_runs_updated_at
  BEFORE UPDATE ON anomaly_detection_runs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
