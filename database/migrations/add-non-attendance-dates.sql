-- Create table for admin-defined non-attendance dates
-- These dates will be excluded from attendance calculations
-- Examples: weekends, holidays, special events, program rest days

CREATE TABLE IF NOT EXISTS non_attendance_dates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  reason VARCHAR(255) NOT NULL, -- e.g., "Weekend", "National Holiday", "Program Break"
  description TEXT,
  program_id UUID REFERENCES programs(id) ON DELETE CASCADE, -- NULL = applies to all programs
  is_recurring BOOLEAN DEFAULT false, -- If true, applies every year (e.g., Christmas)
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(date, program_id) -- Prevent duplicate dates for same program
);

-- Index for faster date lookups
CREATE INDEX idx_non_attendance_dates_date ON non_attendance_dates(date);
CREATE INDEX idx_non_attendance_dates_program ON non_attendance_dates(program_id);

-- Trigger to update updated_at
CREATE TRIGGER update_non_attendance_dates_updated_at
  BEFORE UPDATE ON non_attendance_dates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE non_attendance_dates IS 'Admin-defined dates to exclude from attendance (holidays, weekends, etc.)';
COMMENT ON COLUMN non_attendance_dates.program_id IS 'NULL = applies globally to all programs, otherwise program-specific';
COMMENT ON COLUMN non_attendance_dates.is_recurring IS 'If true, applies annually (like Christmas Day)';
