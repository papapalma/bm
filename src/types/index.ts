export interface User {
  id: string;
  auth_user_id?: string | null;
  email: string;
  username: string;
  role: 'admin' | 'staff-inventory' | 'staff-trainees' | 'trainee';
  created_at: string;
  updated_at: string;
}

export interface Item {
  id: string;
  name: string;
  description: string;
  category: string;
  quantity: number;
  available_quantity: number;
  unit: string;
  location: string;
  qr_code: string;
  image_path?: string;
  thumbnail_path?: string;
  qr_code_path?: string;
  status: 'available' | 'low_stock' | 'out_of_stock' | 'maintenance';
  minimum_quantity: number;
  purchase_date?: string;
  condition?: 'New' | 'Good' | 'Fair' | 'Poor' | 'Damaged';
  created_at: string;
  updated_at: string;
  created_by: string;
}

export interface Trainee {
  id: string;
  first_name: string;
  last_name: string;
  middle_name: string;
  email: string;
  phone: string;
  sex: 'Male' | 'Female';
  birth_date: string;
  birth_place: string;
  civil_status: 'Single' | 'Married' | 'Widowed' | 'Separated';
  province: string;
  municipality: string;
  barangay: string;
  street: string;
  educational_attainment: 'Elementary' | 'High School' | 'Senior High School' | 'Vocational' | 'College' | 'Post Graduate';
  course: string;
  year_graduated: string;
  classification: 'Out-of-School Youth' | 'Student' | 'Unemployed' | 'Underemployed' | '4Ps Beneficiary';
  disability?: string | null;
  employment_status: 'Employed' | 'Unemployed' | 'Self-employed' | 'Student';
  program_id: string;
  qr_code: string;
  photo_path?: string | null;
  thumbnail_path?: string;
  qr_code_path?: string | null;
  emergency_contact_name?: string | null;
  emergency_contact_phone?: string | null;
  status: 'active' | 'inactive' | 'completed' | 'dropped';
  enrollment_date: string;
  created_at: string;
  updated_at: string;
}

export interface Program {
  id: string;
  name: string;
  description: string;
  duration_weeks: number;
  start_date: string;
  end_date: string;
  status: 'active' | 'completed' | 'upcoming' | 'cancelled';
  max_trainees: number;
  instructor?: string | null;
  image_path?: string;
  thumbnail_path?: string;
  created_at: string;
  updated_at: string;
}

export interface Lending {
  id: string;
  item_id: string;
  trainee_id?: string;
  borrower_name?: string;
  borrower_contact?: string;
  quantity: number;
  lent_date: string;
  expected_return_date: string;
  actual_return_date?: string;
  status: 'active' | 'returned' | 'overdue' | 'lost';
  notes?: string;
  lent_by?: string;
  returned_by?: string;
  created_at: string;
  updated_at: string;
  // Joined relations
  item?: Item;
  trainee?: Trainee;
}

export interface Anomaly {
  id: string;
  category: 'trainee' | 'inventory' | 'lending' | 'program' | 'activity_log' | 'system';
  anomaly_type: string;
  severity: 'critical' | 'warning' | 'info';
  status: 'open' | 'in_progress' | 'resolved' | 'dismissed';
  description: string;
  recommendation?: string;
  detection_logic?: string;
  entity_type?: string;
  entity_id?: string;
  entity_identifier?: string;
  metadata?: Record<string, any>;
  auto_resolved: boolean;
  occurrence_count: number;
  first_occurrence_at?: string;
  last_occurrence_at?: string;
  detection_run_id?: string;
  detected_at: string;
  resolved_at?: string | null;
  resolved_by?: string | null;
  resolution_notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ActivityLog {
  id: string;
  user_id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  details?: any;
  ip_address?: string;
  user_agent?: string;
  created_at: string;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface JWTPayload {
  userId: string;
  email: string;
  role: string;
  jti?: string;   // JWT ID — used for token revocation
  iat?: number;
  exp?: number;
}

export interface PendingRegistration {
  id: string;
  username: string;
  email: string;
  password_hash: string;
  first_name: string;
  last_name: string;
  middle_name: string;
  phone: string;
  sex: 'Male' | 'Female';
  birth_date: string;
  birth_place: string;
  civil_status: 'Single' | 'Married' | 'Widowed' | 'Separated';
  province: string;
  municipality: string;
  barangay: string;
  street: string;
  educational_attainment: string;
  course: string;
  year_graduated: string;
  classification: string;
  disability?: string | null;
  employment_status: string;
  program_id: string;
  status: 'pending' | 'approved' | 'rejected';
  rejection_reason?: string | null;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  created_at: string;
  updated_at: string;
  // Joined
  program?: Program;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  username: string;
  password: string;
  role?: 'staff' | 'viewer';
}
