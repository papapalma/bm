-- Migration: connect missing relational links and add query-driven indexes
-- Safe to run multiple times.

-- ---------------------------------------------------------------------------
-- 1) Connect anomalies.detection_run_id -> anomaly_detection_runs.id
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  has_anomalies BOOLEAN;
  has_runs BOOLEAN;
  detection_run_col_type TEXT;
  fk_exists BOOLEAN;
BEGIN
  SELECT to_regclass('public.anomalies') IS NOT NULL INTO has_anomalies;
  SELECT to_regclass('public.anomaly_detection_runs') IS NOT NULL INTO has_runs;

  IF has_anomalies AND has_runs THEN
    SELECT data_type
    INTO detection_run_col_type
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'anomalies'
      AND column_name = 'detection_run_id';

    -- Normalize legacy text IDs to UUID when possible.
    IF detection_run_col_type IS NOT NULL AND detection_run_col_type <> 'uuid' THEN
      UPDATE anomalies
      SET detection_run_id = NULL
      WHERE detection_run_id IS NOT NULL
        AND detection_run_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$';

      ALTER TABLE anomalies
        ALTER COLUMN detection_run_id TYPE UUID
        USING detection_run_id::uuid;
    END IF;

    -- Prevent FK creation failure from orphan values.
    UPDATE anomalies a
    SET detection_run_id = NULL
    WHERE detection_run_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1
        FROM anomaly_detection_runs r
        WHERE r.id = a.detection_run_id
      );

    SELECT EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conname = 'fk_anomalies_detection_run'
        AND conrelid = 'public.anomalies'::regclass
    ) INTO fk_exists;

    IF NOT fk_exists THEN
      ALTER TABLE anomalies
        ADD CONSTRAINT fk_anomalies_detection_run
        FOREIGN KEY (detection_run_id)
        REFERENCES anomaly_detection_runs(id)
        ON DELETE SET NULL;
    END IF;
  END IF;
END
$$;

-- ---------------------------------------------------------------------------
-- 2) Core table indexes for frequent joins and filters
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_pending_registrations_reviewed_by
  ON pending_registrations(reviewed_by);

CREATE INDEX IF NOT EXISTS idx_program_sessions_program_date
  ON program_sessions(program_id, session_date);

CREATE INDEX IF NOT EXISTS idx_attendance_scanned_by
  ON attendance(scanned_by);

CREATE INDEX IF NOT EXISTS idx_attendance_session_status
  ON attendance(session_id, status);

CREATE INDEX IF NOT EXISTS idx_lendings_returned_by
  ON lendings(returned_by);

CREATE INDEX IF NOT EXISTS idx_lendings_status_expected_return_date
  ON lendings(status, expected_return_date);

CREATE INDEX IF NOT EXISTS idx_lendings_trainee_status
  ON lendings(trainee_id, status);

CREATE INDEX IF NOT EXISTS idx_anomalies_resolved_by
  ON anomalies(resolved_by);

CREATE INDEX IF NOT EXISTS idx_anomalies_status_detected_at
  ON anomalies(status, detected_at DESC);

CREATE INDEX IF NOT EXISTS idx_activity_logs_user_created_at
  ON activity_logs(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_activity_logs_entity_created_at
  ON activity_logs(entity_type, entity_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_activity_logs_action_created_at
  ON activity_logs(action, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_non_attendance_dates_created_by
  ON non_attendance_dates(created_by);

CREATE INDEX IF NOT EXISTS idx_non_attendance_dates_program_date
  ON non_attendance_dates(program_id, date);

-- ---------------------------------------------------------------------------
-- 3) Optional table indexes (only if migration-created tables exist)
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF to_regclass('public.report_schedules') IS NOT NULL THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_report_schedules_created_by ON report_schedules(created_by)';
  END IF;

  IF to_regclass('public.refresh_tokens') IS NOT NULL THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_refresh_tokens_rotated_from ON refresh_tokens(rotated_from)';
  END IF;

  IF to_regclass('public.password_reset_requests') IS NOT NULL THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_password_reset_requests_approved_by ON password_reset_requests(approved_by)';
  END IF;
END
$$;