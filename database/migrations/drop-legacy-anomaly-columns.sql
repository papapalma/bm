-- Migration: Drop legacy columns from anomalies table
-- This completes the schema migration started in update-anomaly-schema.sql
-- The legacy "type" and "lending_id" columns have been replaced by:
--   - type → anomaly_type (more descriptive)
--   - lending_id → entity_type + entity_id (generic entity reference)

-- Drop the legacy "type" column
ALTER TABLE anomalies DROP COLUMN IF EXISTS type;

-- Drop the legacy "lending_id" column
ALTER TABLE anomalies DROP COLUMN IF EXISTS lending_id;

-- Verify the schema is correct
-- The anomalies table should now have:
--   - category (NOT NULL)
--   - anomaly_type (NOT NULL)
--   - entity_type, entity_id, entity_identifier (for generic entity references)
