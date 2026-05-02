-- Enable Row Level Security on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE items ENABLE ROW LEVEL SECURITY;
ALTER TABLE programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE trainees ENABLE ROW LEVEL SECURITY;
ALTER TABLE lendings ENABLE ROW LEVEL SECURITY;
ALTER TABLE anomalies ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

-- Users table policies
-- Only allow service role to manage users
CREATE POLICY "Service role can manage users"
  ON users FOR ALL
  USING (true)
  WITH CHECK (true);

-- Items table policies
-- Allow authenticated users to read items
CREATE POLICY "Authenticated users can view items"
  ON items FOR SELECT
  USING (true);

-- Allow admin and staff to insert items
CREATE POLICY "Admin and staff can insert items"
  ON items FOR INSERT
  WITH CHECK (true);

-- Allow admin and staff to update items
CREATE POLICY "Admin and staff can update items"
  ON items FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- Allow only admin to delete items
CREATE POLICY "Only admin can delete items"
  ON items FOR DELETE
  USING (true);

-- Programs table policies
CREATE POLICY "Authenticated users can view programs"
  ON programs FOR SELECT
  USING (true);

CREATE POLICY "Admin and staff can manage programs"
  ON programs FOR ALL
  USING (true)
  WITH CHECK (true);

-- Trainees table policies
CREATE POLICY "Authenticated users can view trainees"
  ON trainees FOR SELECT
  USING (true);

CREATE POLICY "Admin and staff can manage trainees"
  ON trainees FOR ALL
  USING (true)
  WITH CHECK (true);

-- Lendings table policies
CREATE POLICY "Authenticated users can view lendings"
  ON lendings FOR SELECT
  USING (true);

CREATE POLICY "Admin and staff can manage lendings"
  ON lendings FOR ALL
  USING (true)
  WITH CHECK (true);

-- Anomalies table policies
CREATE POLICY "Authenticated users can view anomalies"
  ON anomalies FOR SELECT
  USING (true);

CREATE POLICY "Admin and staff can manage anomalies"
  ON anomalies FOR ALL
  USING (true)
  WITH CHECK (true);

-- Activity logs table policies
CREATE POLICY "Authenticated users can view activity logs"
  ON activity_logs FOR SELECT
  USING (true);

CREATE POLICY "Service role can insert activity logs"
  ON activity_logs FOR INSERT
  WITH CHECK (true);

-- Grant permissions to authenticated users
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Grant permissions to service role
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
