-- ============================================
-- BMDC COMPLETE DATABASE SETUP - FRESH INSTALL
-- ============================================
-- This script will:
-- 1. Drop all existing tables (DESTRUCTIVE!)
-- 2. Create all tables with correct schema
-- 3. Create indexes for performance
-- 4. Create triggers for auto-updates
-- 5. Seed initial data (admin users, sample programs)
--
-- ⚠️ WARNING: This will DELETE ALL DATA!
-- Only run this for a fresh database setup.
-- ============================================

-- ============================================
-- STEP 1: DROP ALL TABLES (Fresh Start)
-- ============================================

DROP TABLE IF EXISTS non_attendance_dates CASCADE;
DROP TABLE IF EXISTS activity_logs CASCADE;
DROP TABLE IF EXISTS anomalies CASCADE;
DROP TABLE IF EXISTS anomaly_detection_runs CASCADE;
DROP TABLE IF EXISTS anomaly_detection_configs CASCADE;
DROP TABLE IF EXISTS lendings CASCADE;
DROP TABLE IF EXISTS attendance CASCADE;
DROP TABLE IF EXISTS pending_registrations CASCADE;
DROP TABLE IF EXISTS trainee_accounts CASCADE;
DROP TABLE IF EXISTS trainees CASCADE;
DROP TABLE IF EXISTS program_sessions CASCADE;
DROP TABLE IF EXISTS program_instructors CASCADE;
DROP TABLE IF EXISTS instructors CASCADE;
DROP TABLE IF EXISTS programs CASCADE;
DROP TABLE IF EXISTS items CASCADE;
DROP TABLE IF EXISTS cms_settings CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- ============================================
-- STEP 2: CREATE TABLES
-- ============================================

-- Users Table
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id UUID UNIQUE,
  email VARCHAR(255) UNIQUE NOT NULL,
  username VARCHAR(100) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL CHECK (role IN ('admin', 'staff-inventory', 'staff-trainees', 'trainee')),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Items Table
CREATE TABLE items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(100) NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 0,
  available_quantity INTEGER NOT NULL DEFAULT 0,
  unit VARCHAR(50) NOT NULL DEFAULT 'piece(s)',
  location VARCHAR(255),
  qr_code VARCHAR(255) UNIQUE NOT NULL,
  image_path VARCHAR(500),
  qr_code_path VARCHAR(500),
  status VARCHAR(50) NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'low_stock', 'out_of_stock', 'maintenance')),
  minimum_quantity INTEGER DEFAULT 0,
  purchase_date DATE,
  condition VARCHAR(50) CHECK (condition IN ('New', 'Good', 'Fair', 'Poor', 'Damaged')),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Programs Table
CREATE TABLE programs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  duration_weeks INTEGER NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'active', 'completed', 'cancelled')),
  max_trainees INTEGER,
  image_path VARCHAR(500),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Pending Trainee Registrations Table
CREATE TABLE pending_registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username VARCHAR(100) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  middle_name VARCHAR(100) NOT NULL DEFAULT '',
  phone VARCHAR(20) NOT NULL,
  sex VARCHAR(10) NOT NULL,
  birth_date DATE NOT NULL,
  birth_place VARCHAR(255) NOT NULL,
  civil_status VARCHAR(20) NOT NULL,
  province VARCHAR(100) NOT NULL,
  municipality VARCHAR(100) NOT NULL,
  barangay VARCHAR(100) NOT NULL,
  street TEXT NOT NULL,
  educational_attainment VARCHAR(100) NOT NULL,
  course VARCHAR(255) NOT NULL,
  year_graduated VARCHAR(4) NOT NULL,
  classification VARCHAR(100) NOT NULL,
  disability VARCHAR(100),
  employment_status VARCHAR(50) NOT NULL,
  program_id UUID NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  rejection_reason TEXT,
  reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Instructors Table
CREATE TABLE instructors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  middle_name VARCHAR(100),
  email VARCHAR(255) UNIQUE NOT NULL,
  phone VARCHAR(20),
  specialization VARCHAR(255),
  bio TEXT,
  photo_path VARCHAR(500),
  status VARCHAR(50) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Program Instructors (Many-to-Many)
CREATE TABLE program_instructors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id UUID NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  instructor_id UUID NOT NULL REFERENCES instructors(id) ON DELETE CASCADE,
  role VARCHAR(100) DEFAULT 'instructor', -- instructor, assistant, guest
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(program_id, instructor_id)
);

-- Program Sessions (Schedule/Timeline)
CREATE TABLE program_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id UUID NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  session_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  location VARCHAR(255),
  session_type VARCHAR(50) DEFAULT 'lecture' CHECK (session_type IN ('lecture', 'lab', 'workshop', 'exam', 'seminar', 'field_trip')),
  status VARCHAR(50) NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'completed', 'cancelled', 'postponed')),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Trainees Table (Must be created before attendance and trainee_accounts)
CREATE TABLE trainees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  middle_name VARCHAR(100) NOT NULL,
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(20) NOT NULL,
  sex VARCHAR(10) NOT NULL CHECK (sex IN ('Male', 'Female')),
  birth_date DATE NOT NULL,
  birth_place VARCHAR(255) NOT NULL,
  civil_status VARCHAR(20) NOT NULL CHECK (civil_status IN ('Single', 'Married', 'Widowed', 'Separated')),
  province VARCHAR(100) NOT NULL,
  municipality VARCHAR(100) NOT NULL,
  barangay VARCHAR(100) NOT NULL,
  street VARCHAR(255) NOT NULL,
  educational_attainment VARCHAR(100) NOT NULL CHECK (educational_attainment IN ('Elementary', 'High School', 'Senior High School', 'Vocational', 'College', 'Post Graduate')),
  course VARCHAR(255) NOT NULL,
  year_graduated VARCHAR(4) NOT NULL,
  classification VARCHAR(100) NOT NULL CHECK (classification IN ('Out-of-School Youth', 'Student', 'Unemployed', 'Underemployed', '4Ps Beneficiary')),
  disability VARCHAR(100),
  employment_status VARCHAR(50) NOT NULL CHECK (employment_status IN ('Employed', 'Unemployed', 'Self-employed', 'Student')),
  program_id UUID REFERENCES programs(id) ON DELETE SET NULL,
  qr_code VARCHAR(255) UNIQUE NOT NULL,
  photo_path VARCHAR(500),
  qr_code_path VARCHAR(500),
  status VARCHAR(50) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'completed', 'dropped')),
  enrollment_date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Trainee User Accounts (Link trainees to user accounts)
CREATE TABLE trainee_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trainee_id UUID UNIQUE NOT NULL REFERENCES trainees(id) ON DELETE CASCADE,
  user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Attendance Table
CREATE TABLE attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES program_sessions(id) ON DELETE CASCADE,
  trainee_id UUID NOT NULL REFERENCES trainees(id) ON DELETE CASCADE,
  status VARCHAR(50) NOT NULL DEFAULT 'absent' CHECK (status IN ('present', 'absent', 'late', 'excused')),
  check_in_time TIMESTAMP,
  check_out_time TIMESTAMP,
  scanned_by UUID REFERENCES users(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(session_id, trainee_id)
);

-- Lendings Table
CREATE TABLE lendings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  trainee_id UUID NOT NULL REFERENCES trainees(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL,
  lent_date TIMESTAMP NOT NULL DEFAULT NOW(),
  expected_return_date DATE NOT NULL,
  actual_return_date TIMESTAMP,
  status VARCHAR(50) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'returned', 'overdue', 'lost')),
  notes TEXT,
  lent_by UUID REFERENCES users(id) ON DELETE SET NULL,
  returned_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Anomaly Detection Configurations Table
CREATE TABLE anomaly_detection_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_key VARCHAR(100) NOT NULL UNIQUE,
  config_value JSONB NOT NULL DEFAULT '{}'::jsonb,
  description TEXT,
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_by VARCHAR(255) NOT NULL DEFAULT 'system',
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Anomaly Detection Runs Table
CREATE TABLE anomaly_detection_runs (
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

-- Anomalies Table
CREATE TABLE anomalies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Categorization (replaces legacy "type" column)
  category VARCHAR(50) NOT NULL DEFAULT 'system' CHECK (category IN ('trainee', 'inventory', 'lending', 'program', 'activity_log', 'system')),
  anomaly_type VARCHAR(100) NOT NULL DEFAULT 'system_alert',
  severity VARCHAR(50) NOT NULL CHECK (severity IN ('critical', 'warning', 'info')),
  status VARCHAR(50) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'dismissed')),
  description TEXT NOT NULL,
  recommendation TEXT,
  detection_logic TEXT,
  -- Generic entity reference
  entity_type VARCHAR(100),
  entity_id UUID,
  entity_identifier VARCHAR(255),
  -- Metadata and occurrence tracking
  metadata JSONB,
  auto_resolved BOOLEAN NOT NULL DEFAULT FALSE,
  occurrence_count INTEGER NOT NULL DEFAULT 1,
  first_occurrence_at TIMESTAMP DEFAULT NOW(),
  last_occurrence_at TIMESTAMP DEFAULT NOW(),
  detection_run_id UUID REFERENCES anomaly_detection_runs(id) ON DELETE SET NULL,
  -- Resolution fields
  detected_at TIMESTAMP DEFAULT NOW(),
  resolved_at TIMESTAMP,
  resolved_by UUID REFERENCES users(id) ON DELETE SET NULL,
  resolution_notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Activity Logs Table
CREATE TABLE activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(50) NOT NULL,
  entity_id UUID,
  details JSONB,
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Non-Attendance Dates Table
CREATE TABLE non_attendance_dates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  reason VARCHAR(255) NOT NULL,
  description TEXT,
  program_id UUID REFERENCES programs(id) ON DELETE CASCADE,
  is_recurring BOOLEAN DEFAULT false,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(date, program_id)
);

-- CMS Settings Table
CREATE TABLE cms_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key VARCHAR(255) UNIQUE NOT NULL,
  value TEXT,
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- STEP 3: CREATE INDEXES
-- ============================================

-- Users indexes
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);

-- Pending registrations indexes
CREATE INDEX idx_pending_registrations_status ON pending_registrations(status);
CREATE INDEX idx_pending_registrations_email ON pending_registrations(email);
CREATE INDEX idx_pending_registrations_program ON pending_registrations(program_id);
CREATE INDEX idx_pending_registrations_reviewed_by ON pending_registrations(reviewed_by);

-- Items indexes
CREATE INDEX idx_items_category ON items(category);
CREATE INDEX idx_items_status ON items(status);
CREATE INDEX idx_items_qr_code ON items(qr_code);
CREATE INDEX idx_items_created_by ON items(created_by);

-- Programs indexes
CREATE INDEX idx_programs_status ON programs(status);
CREATE INDEX idx_programs_dates ON programs(start_date, end_date);

-- Instructors indexes
CREATE INDEX idx_instructors_email ON instructors(email);
CREATE INDEX idx_instructors_status ON instructors(status);
CREATE INDEX idx_instructors_name ON instructors(last_name, first_name);

-- Program Instructors indexes
CREATE INDEX idx_program_instructors_program ON program_instructors(program_id);
CREATE INDEX idx_program_instructors_instructor ON program_instructors(instructor_id);

-- Program Sessions indexes
CREATE INDEX idx_program_sessions_program ON program_sessions(program_id);
CREATE INDEX idx_program_sessions_date ON program_sessions(session_date);
CREATE INDEX idx_program_sessions_status ON program_sessions(status);
CREATE INDEX idx_program_sessions_program_date ON program_sessions(program_id, session_date);

-- Attendance indexes
CREATE INDEX idx_attendance_session ON attendance(session_id);
CREATE INDEX idx_attendance_trainee ON attendance(trainee_id);
CREATE INDEX idx_attendance_status ON attendance(status);
CREATE INDEX idx_attendance_date ON attendance(check_in_time);
CREATE INDEX idx_attendance_scanned_by ON attendance(scanned_by);
CREATE INDEX idx_attendance_session_status ON attendance(session_id, status);

-- Trainee Accounts indexes
CREATE INDEX idx_trainee_accounts_trainee ON trainee_accounts(trainee_id);
CREATE INDEX idx_trainee_accounts_user ON trainee_accounts(user_id);

-- Trainees indexes
CREATE INDEX idx_trainees_program_id ON trainees(program_id);
CREATE INDEX idx_trainees_status ON trainees(status);
CREATE INDEX idx_trainees_qr_code ON trainees(qr_code);
CREATE INDEX idx_trainees_email ON trainees(email);
CREATE INDEX idx_trainees_name ON trainees(last_name, first_name);

-- Lendings indexes
CREATE INDEX idx_lendings_item_id ON lendings(item_id);
CREATE INDEX idx_lendings_trainee_id ON lendings(trainee_id);
CREATE INDEX idx_lendings_status ON lendings(status);
CREATE INDEX idx_lendings_dates ON lendings(lent_date, expected_return_date);
CREATE INDEX idx_lendings_lent_by ON lendings(lent_by);
CREATE INDEX idx_lendings_returned_by ON lendings(returned_by);
CREATE INDEX idx_lendings_status_expected_return_date ON lendings(status, expected_return_date);
CREATE INDEX idx_lendings_trainee_status ON lendings(trainee_id, status);

-- Anomalies indexes
CREATE INDEX idx_anomalies_category ON anomalies(category);
CREATE INDEX idx_anomalies_anomaly_type ON anomalies(anomaly_type);
CREATE INDEX idx_anomalies_status ON anomalies(status);
CREATE INDEX idx_anomalies_severity ON anomalies(severity);
CREATE INDEX idx_anomalies_detected_at ON anomalies(detected_at);
CREATE INDEX idx_anomalies_entity ON anomalies(entity_type, entity_id);
CREATE INDEX idx_anomalies_resolved_by ON anomalies(resolved_by);
CREATE INDEX idx_anomalies_status_detected_at ON anomalies(status, detected_at DESC);
CREATE INDEX idx_anomalies_detection_run_id ON anomalies(detection_run_id);

-- Anomaly detection operations indexes
CREATE INDEX idx_anomaly_detection_runs_started_at ON anomaly_detection_runs(started_at DESC);
CREATE INDEX idx_anomaly_detection_runs_status ON anomaly_detection_runs(status);
CREATE INDEX idx_anomaly_detection_runs_trigger_type ON anomaly_detection_runs(trigger_type);

-- Activity logs indexes
CREATE INDEX idx_activity_logs_user_id ON activity_logs(user_id);
CREATE INDEX idx_activity_logs_entity ON activity_logs(entity_type, entity_id);
CREATE INDEX idx_activity_logs_created_at ON activity_logs(created_at);
CREATE INDEX idx_activity_logs_action ON activity_logs(action);
CREATE INDEX idx_activity_logs_user_created_at ON activity_logs(user_id, created_at DESC);
CREATE INDEX idx_activity_logs_entity_created_at ON activity_logs(entity_type, entity_id, created_at DESC);
CREATE INDEX idx_activity_logs_action_created_at ON activity_logs(action, created_at DESC);

-- Non-attendance dates indexes
CREATE INDEX idx_non_attendance_dates_date ON non_attendance_dates(date);
CREATE INDEX idx_non_attendance_dates_program ON non_attendance_dates(program_id);
CREATE INDEX idx_non_attendance_dates_created_by ON non_attendance_dates(created_by);
CREATE INDEX idx_non_attendance_dates_program_date ON non_attendance_dates(program_id, date);

-- CMS settings indexes
CREATE INDEX idx_cms_settings_key ON cms_settings(key);

-- ============================================
-- STEP 4: CREATE TRIGGERS
-- ============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers to all tables with updated_at
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_pending_registrations_updated_at
  BEFORE UPDATE ON pending_registrations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_items_updated_at
  BEFORE UPDATE ON items
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_programs_updated_at
  BEFORE UPDATE ON programs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_instructors_updated_at
  BEFORE UPDATE ON instructors
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_program_sessions_updated_at
  BEFORE UPDATE ON program_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_attendance_updated_at
  BEFORE UPDATE ON attendance
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_trainees_updated_at
  BEFORE UPDATE ON trainees
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_lendings_updated_at
  BEFORE UPDATE ON lendings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_anomalies_updated_at
  BEFORE UPDATE ON anomalies
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_anomaly_detection_configs_updated_at
  BEFORE UPDATE ON anomaly_detection_configs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_anomaly_detection_runs_updated_at
  BEFORE UPDATE ON anomaly_detection_runs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_non_attendance_dates_updated_at
  BEFORE UPDATE ON non_attendance_dates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_cms_settings_updated_at
  BEFORE UPDATE ON cms_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- STEP 5: SEED INITIAL DATA
-- ============================================

-- Seed Users (Password: admin123)
INSERT INTO users (email, username, password_hash, role)
VALUES 
  ('admin@bmdc.edu.ph', 'admin', '$2a$10$d.hOU/nLCUmdfBchSJen7ueMozsc50O1Jt8/vXGo882OEeXBfoDIu', 'admin'),
  ('inventory@bmdc.edu.ph', 'staff-inventory', '$2a$10$d.hOU/nLCUmdfBchSJen7ueMozsc50O1Jt8/vXGo882OEeXBfoDIu', 'staff-inventory'),
  ('trainees@bmdc.edu.ph', 'staff-trainees', '$2a$10$d.hOU/nLCUmdfBchSJen7ueMozsc50O1Jt8/vXGo882OEeXBfoDIu', 'staff-trainees');

-- Seed default anomaly detection config
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

-- Seed Sample Programs
INSERT INTO programs (name, description, duration_weeks, start_date, end_date, status, max_trainees)
VALUES 
  ('Web Development Bootcamp', 'Intensive 12-week web development training covering HTML, CSS, JavaScript, React, and Node.js', 12, '2026-01-06', '2026-03-30', 'active', 30),
  ('Data Science Fundamentals', 'Comprehensive data science training including Python, statistics, machine learning, and data visualization', 16, '2026-02-03', '2026-05-25', 'active', 25),
  ('Mobile App Development', 'Learn to build mobile applications for iOS and Android using React Native', 10, '2026-04-01', '2026-06-09', 'upcoming', 20);

-- Seed Sample Items (using the admin user as creator)
INSERT INTO items (name, description, category, quantity, available_quantity, unit, location, qr_code, status, minimum_quantity, condition, created_by)
SELECT 
  'Dell XPS 15 Laptop',
  'High-performance laptop with Intel i7, 16GB RAM, 512GB SSD - for development training',
  'Electronics',
  10,
  8,
  'units',
  'Storage Room A - Shelf 1',
  'ITEM-LAPTOP-001',
  'available',
  5,
  'New',
  (SELECT id FROM users WHERE email = 'admin@bmdc.edu.ph');

INSERT INTO items (name, description, category, quantity, available_quantity, unit, location, qr_code, status, minimum_quantity, condition, created_by)
SELECT 
  'Logitech Wireless Mouse',
  'Ergonomic wireless USB mouse',
  'Accessories',
  50,
  45,
  'units',
  'Storage Room B - Cabinet 2',
  'ITEM-MOUSE-001',
  'available',
  20,
  'New',
  (SELECT id FROM users WHERE email = 'admin@bmdc.edu.ph');

INSERT INTO items (name, description, category, quantity, available_quantity, unit, location, qr_code, status, minimum_quantity, condition, created_by)
SELECT 
  'HDMI Cable 2m',
  'Premium 2-meter HDMI cable for display connections',
  'Cables',
  15,
  12,
  'units',
  'Storage Room B - Cabinet 1',
  'ITEM-HDMI-001',
  'available',
  10,
  'Good',
  (SELECT id FROM users WHERE email = 'admin@bmdc.edu.ph');

INSERT INTO items (name, description, category, quantity, available_quantity, unit, location, qr_code, status, minimum_quantity, condition, created_by)
SELECT 
  'A4 Ruled Notebook',
  '100-page ruled notebook for training notes',
  'Office Supplies',
  5,
  3,
  'units',
  'Office Supply Cabinet',
  'ITEM-NOTE-001',
  'low_stock',
  10,
  'New',
  (SELECT id FROM users WHERE email = 'admin@bmdc.edu.ph');

INSERT INTO items (name, description, category, quantity, available_quantity, unit, location, qr_code, status, minimum_quantity, condition, created_by)
SELECT 
  'USB-C Hub Adapter',
  '7-in-1 USB-C hub with HDMI, USB 3.0, SD card reader',
  'Accessories',
  0,
  0,
  'units',
  'Storage Room A - Shelf 2',
  'ITEM-HUB-001',
  'out_of_stock',
  5,
  'Good',
  (SELECT id FROM users WHERE email = 'admin@bmdc.edu.ph');

-- Seed Sample Trainees
INSERT INTO trainees (
  first_name, last_name, middle_name, email, phone,
  sex, birth_date, birth_place, civil_status,
  province, municipality, barangay, street,
  educational_attainment, course, year_graduated,
  classification, disability, employment_status,
  program_id, qr_code, status, enrollment_date
)
SELECT 
  'Juan',
  'Dela Cruz',
  'Santos',
  'juan.delacruz@example.com',
  '09171234567',
  'Male',
  '1998-05-15',
  'Manila City',
  'Single',
  'Metro Manila',
  'Manila',
  'Ermita',
  '123 Rizal Avenue',
  'College',
  'Bachelor of Science in Computer Science',
  '2020',
  'Unemployed',
  NULL,
  'Unemployed',
  (SELECT id FROM programs WHERE name = 'Web Development Bootcamp'),
  'TRAINEE-001',
  'active',
  '2026-01-06';

INSERT INTO trainees (
  first_name, last_name, middle_name, email, phone,
  sex, birth_date, birth_place, civil_status,
  province, municipality, barangay, street,
  educational_attainment, course, year_graduated,
  classification, disability, employment_status,
  program_id, qr_code, status, enrollment_date
)
SELECT 
  'Maria',
  'Garcia',
  'Reyes',
  'maria.garcia@example.com',
  '09187654321',
  'Female',
  '2000-08-22',
  'Quezon City',
  'Single',
  'Metro Manila',
  'Quezon City',
  'Diliman',
  '456 Commonwealth Avenue',
  'College',
  'Bachelor of Science in Information Technology',
  '2024',
  'Student',
  NULL,
  'Student',
  (SELECT id FROM programs WHERE name = 'Web Development Bootcamp'),
  'TRAINEE-002',
  'active',
  '2026-01-06';

INSERT INTO trainees (
  first_name, last_name, middle_name, email, phone,
  sex, birth_date, birth_place, civil_status,
  province, municipality, barangay, street,
  educational_attainment, course, year_graduated,
  classification, disability, employment_status,
  program_id, qr_code, status, enrollment_date
)
SELECT 
  'Pedro',
  'Santos',
  'Martinez',
  'pedro.santos@example.com',
  '09198765432',
  'Male',
  '1995-12-10',
  'Cebu City',
  'Married',
  'Cebu',
  'Cebu City',
  'Lahug',
  '789 Gorordo Avenue',
  'High School',
  'Technical-Vocational',
  '2013',
  'Underemployed',
  NULL,
  'Self-employed',
  (SELECT id FROM programs WHERE name = 'Data Science Fundamentals'),
  'TRAINEE-003',
  'active',
  '2026-02-03';

-- Seed Trainee User Accounts (Password: admin123 - same as other accounts for testing)
-- Create user accounts for the 3 sample trainees
INSERT INTO users (email, username, password_hash, role)
VALUES 
  ('juan.delacruz@example.com', 'juan.delacruz', '$2a$10$d.hOU/nLCUmdfBchSJen7ueMozsc50O1Jt8/vXGo882OEeXBfoDIu', 'trainee'),
  ('maria.garcia@example.com', 'maria.garcia', '$2a$10$d.hOU/nLCUmdfBchSJen7ueMozsc50O1Jt8/vXGo882OEeXBfoDIu', 'trainee'),
  ('pedro.santos@example.com', 'pedro.santos', '$2a$10$d.hOU/nLCUmdfBchSJen7ueMozsc50O1Jt8/vXGo882OEeXBfoDIu', 'trainee');

-- Link trainees to their user accounts
INSERT INTO trainee_accounts (trainee_id, user_id)
SELECT 
  t.id,
  u.id
FROM trainees t
INNER JOIN users u ON t.email = u.email
WHERE u.role = 'trainee';

-- ============================================
-- STEP 6: VERIFICATION
-- ============================================

-- Display summary
SELECT '✅ Database setup complete!' as status;

-- Show counts
SELECT 'Users created: ' || COUNT(*)::text as summary FROM users
UNION ALL
SELECT 'Programs created: ' || COUNT(*)::text FROM programs
UNION ALL
SELECT 'Items created: ' || COUNT(*)::text FROM items
UNION ALL
SELECT 'Trainees created: ' || COUNT(*)::text FROM trainees
UNION ALL
SELECT 'Trainee accounts created: ' || COUNT(*)::text FROM trainee_accounts;

-- Show user accounts
SELECT 
  '📧 Login: ' || email || ' | 👤 Username: ' || username || ' | 🔑 Role: ' || role as "Default Accounts (Password: admin123)"
FROM users
ORDER BY 
  CASE role
    WHEN 'admin' THEN 1
    WHEN 'staff-inventory' THEN 2
    WHEN 'staff-trainees' THEN 3
    WHEN 'trainee' THEN 4
  END;

-- ============================================
-- SETUP COMPLETE!
-- ============================================
