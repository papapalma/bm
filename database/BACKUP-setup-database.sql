-- ============================================
-- COMPLETE DATABASE SETUP SCRIPT
-- This script will create all tables and populate initial data
-- Run this in Supabase SQL Editor to set up a fresh database
-- ============================================

-- ============================================
-- PART 1: CREATE TABLES
-- ============================================

-- Users Table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  username VARCHAR(100) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL CHECK (role IN ('admin', 'staff-inventory', 'staff-trainees')),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Items Table
CREATE TABLE IF NOT EXISTS items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(100) NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 0,
  available_quantity INTEGER NOT NULL DEFAULT 0,
  unit VARCHAR(50) NOT NULL,
  location VARCHAR(255),
  qr_code VARCHAR(255) UNIQUE NOT NULL,
  image_path VARCHAR(500),
  qr_code_path VARCHAR(500),
  status VARCHAR(50) NOT NULL CHECK (status IN ('available', 'low_stock', 'out_of_stock', 'maintenance')),
  minimum_quantity INTEGER DEFAULT 0,
  purchase_date DATE,
  condition VARCHAR(50) CHECK (condition IN ('New', 'Good', 'Fair', 'Poor', 'Damaged')),
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Programs Table
CREATE TABLE IF NOT EXISTS programs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  duration_weeks INTEGER NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status VARCHAR(50) NOT NULL CHECK (status IN ('upcoming', 'active', 'completed', 'cancelled')),
  max_trainees INTEGER,
  image_path VARCHAR(500),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Trainees Table (Complete with all 21 fields)
CREATE TABLE IF NOT EXISTS trainees (
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
  program_id UUID NOT NULL REFERENCES programs(id) ON DELETE SET NULL,
  qr_code VARCHAR(255) UNIQUE NOT NULL,
  photo_path VARCHAR(500),
  qr_code_path VARCHAR(500),
  status VARCHAR(50) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'completed', 'dropped')),
  enrollment_date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Lendings Table
CREATE TABLE IF NOT EXISTS lendings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  trainee_id UUID NOT NULL REFERENCES trainees(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL,
  lent_date TIMESTAMP NOT NULL DEFAULT NOW(),
  expected_return_date DATE NOT NULL,
  actual_return_date TIMESTAMP,
  status VARCHAR(50) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'returned', 'overdue', 'lost')),
  notes TEXT,
  lent_by UUID REFERENCES users(id),
  returned_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Anomalies Table
CREATE TABLE IF NOT EXISTS anomalies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lending_id UUID REFERENCES lendings(id) ON DELETE CASCADE,
  type VARCHAR(100) NOT NULL CHECK (type IN ('overdue', 'unauthorized_access', 'quantity_mismatch', 'damaged_item', 'lost_item', 'system_alert')),
  severity VARCHAR(50) NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  description TEXT NOT NULL,
  detected_at TIMESTAMP DEFAULT NOW(),
  resolved_at TIMESTAMP,
  resolved_by UUID REFERENCES users(id),
  resolution_notes TEXT,
  status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'investigating', 'resolved', 'dismissed')),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Activity Logs Table
CREATE TABLE IF NOT EXISTS activity_logs (
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

-- CMS Settings Table
CREATE TABLE IF NOT EXISTS cms_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key VARCHAR(255) UNIQUE NOT NULL,
  value TEXT,
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- PART 2: CREATE INDEXES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

CREATE INDEX IF NOT EXISTS idx_items_category ON items(category);
CREATE INDEX IF NOT EXISTS idx_items_status ON items(status);
CREATE INDEX IF NOT EXISTS idx_items_qr_code ON items(qr_code);

CREATE INDEX IF NOT EXISTS idx_programs_status ON programs(status);
CREATE INDEX IF NOT EXISTS idx_programs_dates ON programs(start_date, end_date);

CREATE INDEX IF NOT EXISTS idx_trainees_program_id ON trainees(program_id);
CREATE INDEX IF NOT EXISTS idx_trainees_status ON trainees(status);
CREATE INDEX IF NOT EXISTS idx_trainees_qr_code ON trainees(qr_code);
CREATE INDEX IF NOT EXISTS idx_trainees_email ON trainees(email);

CREATE INDEX IF NOT EXISTS idx_lendings_item_id ON lendings(item_id);
CREATE INDEX IF NOT EXISTS idx_lendings_trainee_id ON lendings(trainee_id);
CREATE INDEX IF NOT EXISTS idx_lendings_status ON lendings(status);
CREATE INDEX IF NOT EXISTS idx_lendings_dates ON lendings(lent_date, expected_return_date);

CREATE INDEX IF NOT EXISTS idx_anomalies_lending_id ON anomalies(lending_id);
CREATE INDEX IF NOT EXISTS idx_anomalies_type ON anomalies(type);
CREATE INDEX IF NOT EXISTS idx_anomalies_status ON anomalies(status);
CREATE INDEX IF NOT EXISTS idx_anomalies_severity ON anomalies(severity);
CREATE INDEX IF NOT EXISTS idx_anomalies_detected_at ON anomalies(detected_at);

CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_entity ON activity_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activity_logs(created_at);

-- ============================================
-- PART 3: CREATE TRIGGERS
-- ============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers to all tables
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_items_updated_at ON items;
CREATE TRIGGER update_items_updated_at
  BEFORE UPDATE ON items
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_programs_updated_at ON programs;
CREATE TRIGGER update_programs_updated_at
  BEFORE UPDATE ON programs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_trainees_updated_at ON trainees;
CREATE TRIGGER update_trainees_updated_at
  BEFORE UPDATE ON trainees
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_lendings_updated_at ON lendings;
CREATE TRIGGER update_lendings_updated_at
  BEFORE UPDATE ON lendings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_anomalies_updated_at ON anomalies;
CREATE TRIGGER update_anomalies_updated_at
  BEFORE UPDATE ON anomalies
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_cms_settings_updated_at ON cms_settings;
CREATE TRIGGER update_cms_settings_updated_at
  BEFORE UPDATE ON cms_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- PART 4: SEED INITIAL DATA
-- ============================================

-- Seed Users (Password: admin123)
INSERT INTO users (email, username, password_hash, role)
VALUES 
  ('admin@bmdc.edu.ph', 'admin', '$2a$10$d.hOU/nLCUmdfBchSJen7ueMozsc50O1Jt8/vXGo882OEeXBfoDIu', 'admin'),
  ('inventory@bmdc.edu.ph', 'staff-inventory', '$2a$10$d.hOU/nLCUmdfBchSJen7ueMozsc50O1Jt8/vXGo882OEeXBfoDIu', 'staff-inventory'),
  ('trainees@bmdc.edu.ph', 'staff-trainees', '$2a$10$d.hOU/nLCUmdfBchSJen7ueMozsc50O1Jt8/vXGo882OEeXBfoDIu', 'staff-trainees')
ON CONFLICT (email) DO UPDATE SET 
  password_hash = EXCLUDED.password_hash,
  role = EXCLUDED.role;

-- Seed Programs
INSERT INTO programs (name, description, duration_weeks, start_date, end_date, status, max_trainees)
VALUES 
  ('Web Development Bootcamp', 'Intensive web development training program', 12, '2026-01-01', '2026-03-25', 'active', 30),
  ('Data Science Program', 'Comprehensive data science and analytics training', 16, '2026-02-01', '2026-05-28', 'active', 25),
  ('Mobile App Development', 'Learn to build mobile applications', 10, '2026-04-01', '2026-06-09', 'upcoming', 20)
ON CONFLICT DO NOTHING;

-- Seed Items
INSERT INTO items (name, description, category, quantity, available_quantity, unit, location, qr_code, status, minimum_quantity, created_by)
SELECT 
  'Laptop Dell XPS 15',
  'High-performance laptop for development',
  'Electronics',
  10,
  8,
  'units',
  'Storage Room A',
  'ITEM-LAPTOP-001',
  'available',
  5,
  (SELECT id FROM users WHERE email = 'admin@inventory.com' LIMIT 1)
WHERE NOT EXISTS (SELECT 1 FROM items WHERE qr_code = 'ITEM-LAPTOP-001');

INSERT INTO items (name, description, category, quantity, available_quantity, unit, location, qr_code, status, minimum_quantity, created_by)
SELECT 
  'USB Mouse',
  'Wireless USB mouse',
  'Accessories',
  50,
  45,
  'units',
  'Storage Room B',
  'ITEM-MOUSE-001',
  'available',
  20,
  (SELECT id FROM users WHERE email = 'admin@inventory.com' LIMIT 1)
WHERE NOT EXISTS (SELECT 1 FROM items WHERE qr_code = 'ITEM-MOUSE-001');

INSERT INTO items (name, description, category, quantity, available_quantity, unit, location, qr_code, status, minimum_quantity, created_by)
SELECT 
  'HDMI Cable',
  '2-meter HDMI cable',
  'Cables',
  15,
  12,
  'units',
  'Storage Room B',
  'ITEM-HDMI-001',
  'available',
  10,
  (SELECT id FROM users WHERE email = 'admin@inventory.com' LIMIT 1)
WHERE NOT EXISTS (SELECT 1 FROM items WHERE qr_code = 'ITEM-HDMI-001');

INSERT INTO items (name, description, category, quantity, available_quantity, unit, location, qr_code, status, minimum_quantity, created_by)
SELECT 
  'Notebook',
  'A4 ruled notebook',
  'Office Supplies',
  5,
  3,
  'units',
  'Office Supply Cabinet',
  'ITEM-NOTE-001',
  'low_stock',
  10,
  (SELECT id FROM users WHERE email = 'admin@inventory.com' LIMIT 1)
WHERE NOT EXISTS (SELECT 1 FROM items WHERE qr_code = 'ITEM-NOTE-001');

-- Seed Sample Trainees (demonstrating all 21 fields)
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
  'Manila',
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
  (SELECT id FROM programs WHERE name = 'Web Development Bootcamp' LIMIT 1),
  'TRAINEE-001',
  'active',
  '2026-01-01'
WHERE NOT EXISTS (SELECT 1 FROM trainees WHERE qr_code = 'TRAINEE-001');

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
  (SELECT id FROM programs WHERE name = 'Web Development Bootcamp' LIMIT 1),
  'TRAINEE-002',
  'active',
  '2026-01-01'
WHERE NOT EXISTS (SELECT 1 FROM trainees WHERE qr_code = 'TRAINEE-002');

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
  (SELECT id FROM programs WHERE name = 'Data Science Program' LIMIT 1),
  'TRAINEE-003',
  'active',
  '2026-02-01'
WHERE NOT EXISTS (SELECT 1 FROM trainees WHERE qr_code = 'TRAINEE-003');

-- ============================================
-- SETUP COMPLETE
-- ============================================

-- Verify setup
SELECT 'Database setup complete!' as status;
SELECT 'Users created: ' || COUNT(*)::text FROM users;
SELECT 'Programs created: ' || COUNT(*)::text FROM programs;
SELECT 'Items created: ' || COUNT(*)::text FROM items;
SELECT 'Trainees created: ' || COUNT(*)::text FROM trainees;
