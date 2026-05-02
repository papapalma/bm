-- Function to automatically update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to search items
CREATE OR REPLACE FUNCTION search_items(search_query TEXT)
RETURNS TABLE (
  id UUID,
  name VARCHAR,
  description TEXT,
  category VARCHAR,
  quantity INTEGER,
  available_quantity INTEGER,
  status VARCHAR,
  qr_code VARCHAR
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    i.id,
    i.name,
    i.description,
    i.category,
    i.quantity,
    i.available_quantity,
    i.status,
    i.qr_code
  FROM items i
  WHERE 
    i.name ILIKE '%' || search_query || '%' OR
    i.description ILIKE '%' || search_query || '%' OR
    i.category ILIKE '%' || search_query || '%' OR
    i.qr_code ILIKE '%' || search_query || '%';
END;
$$ LANGUAGE plpgsql;

-- Function to get inventory statistics
CREATE OR REPLACE FUNCTION get_inventory_stats()
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'total_items', COUNT(*),
    'total_quantity', SUM(quantity),
    'available_quantity', SUM(available_quantity),
    'borrowed_quantity', SUM(quantity - available_quantity),
    'low_stock_count', COUNT(*) FILTER (WHERE status = 'low_stock'),
    'out_of_stock_count', COUNT(*) FILTER (WHERE status = 'out_of_stock')
  )
  INTO result
  FROM items;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Function to get active lendings count
CREATE OR REPLACE FUNCTION get_active_lendings_count()
RETURNS INTEGER AS $$
DECLARE
  count INTEGER;
BEGIN
  SELECT COUNT(*)
  INTO count
  FROM lendings
  WHERE status IN ('active', 'overdue');
  
  RETURN count;
END;
$$ LANGUAGE plpgsql;

-- Function to check and update overdue lendings
CREATE OR REPLACE FUNCTION check_overdue_lendings()
RETURNS INTEGER AS $$
DECLARE
  updated_count INTEGER;
BEGIN
  WITH updated AS (
    UPDATE lendings
    SET status = 'overdue'
    WHERE status IN ('active', 'partially_returned')
      AND expected_return_date < NOW()
    RETURNING id
  )
  SELECT COUNT(*) INTO updated_count FROM updated;
  
  RETURN updated_count;
END;
$$ LANGUAGE plpgsql;

-- Function to get program statistics
CREATE OR REPLACE FUNCTION get_program_stats(program_uuid UUID)
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'total_trainees', COUNT(*),
    'active_trainees', COUNT(*) FILTER (WHERE status = 'active'),
    'inactive_trainees', COUNT(*) FILTER (WHERE status = 'inactive'),
    'graduated_trainees', COUNT(*) FILTER (WHERE status = 'graduated')
  )
  INTO result
  FROM trainees
  WHERE program_id = program_uuid;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Function to get anomaly statistics
CREATE OR REPLACE FUNCTION get_anomaly_stats()
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'total', COUNT(*),
    'pending', COUNT(*) FILTER (WHERE status = 'pending'),
    'investigating', COUNT(*) FILTER (WHERE status = 'investigating'),
    'resolved', COUNT(*) FILTER (WHERE status = 'resolved'),
    'dismissed', COUNT(*) FILTER (WHERE status = 'dismissed'),
    'critical', COUNT(*) FILTER (WHERE severity = 'critical'),
    'high', COUNT(*) FILTER (WHERE severity = 'high'),
    'medium', COUNT(*) FILTER (WHERE severity = 'medium'),
    'low', COUNT(*) FILTER (WHERE severity = 'low')
  )
  INTO result
  FROM anomalies;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Function to log activity
CREATE OR REPLACE FUNCTION log_activity(
  p_user_id UUID,
  p_action VARCHAR,
  p_entity_type VARCHAR,
  p_entity_id UUID,
  p_changes JSONB DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  log_id UUID;
BEGIN
  INSERT INTO activity_logs (user_id, action, entity_type, entity_id, changes)
  VALUES (p_user_id, p_action, p_entity_type, p_entity_id, p_changes)
  RETURNING id INTO log_id;
  
  RETURN log_id;
END;
$$ LANGUAGE plpgsql;
