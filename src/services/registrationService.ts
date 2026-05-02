import { supabase, supabaseAdmin } from '@/lib/supabase';
import { hashPassword, generateToken } from '@/lib/auth';
import { PendingRegistration } from '@/types';
import { TraineeRegistrationInput } from '@/utils/validators';

export class RegistrationService {
  private throwIfPendingRegistrationsMissing(error: any): void {
    const message = typeof error?.message === 'string' ? error.message : '';
    const isMissingPendingRegistrations =
      message.includes("public.pending_registrations") ||
      message.includes("relation \"pending_registrations\" does not exist");

    if (isMissingPendingRegistrations) {
      throw new Error(
        'Registration system is not initialized. Run Backend/database/pending_registrations.sql in your Supabase SQL Editor.'
      );
    }
  }

  /**
   * Submit a new trainee registration request (public - no auth)
   */
  async submitRegistration(data: TraineeRegistrationInput): Promise<PendingRegistration> {
    // Check for duplicate email in pending_registrations
    const { data: existingPending, error: existingPendingError } = await supabase
      .from('pending_registrations')
      .select('id, status')
      .eq('email', data.email.toLowerCase())
      .in('status', ['pending', 'approved'])
      .maybeSingle();

    if (existingPendingError && existingPendingError.code !== 'PGRST116') {
      this.throwIfPendingRegistrationsMissing(existingPendingError);
      throw existingPendingError;
    }

    if (existingPending) {
      if (existingPending.status === 'approved') {
        throw new Error('An account with this email already exists. Please log in.');
      }
      throw new Error('A registration request with this email is already pending review.');
    }

    // Check if email already has an active user account
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('email', data.email.toLowerCase())
      .maybeSingle();

    if (existingUser) {
      throw new Error('An account with this email already exists. Please log in.');
    }

    // Check if username is taken
    const { data: existingUsername } = await supabase
      .from('users')
      .select('id')
      .eq('username', data.username)
      .maybeSingle();

    if (existingUsername) {
      throw new Error('This username is already taken. Please choose another.');
    }

    // Check for pending registration with same username
    const { data: existingPendingUsername, error: existingPendingUsernameError } = await supabase
      .from('pending_registrations')
      .select('id')
      .eq('username', data.username)
      .eq('status', 'pending')
      .maybeSingle();

    if (existingPendingUsernameError && existingPendingUsernameError.code !== 'PGRST116') {
      this.throwIfPendingRegistrationsMissing(existingPendingUsernameError);
      throw existingPendingUsernameError;
    }

    if (existingPendingUsername) {
      throw new Error('This username is already pending approval for another registration.');
    }

    // Hash password before storing
    const password_hash = await hashPassword(data.password);

    const { password, ...regData } = data;

    const { data: registration, error } = await supabaseAdmin
      .from('pending_registrations')
      .insert({
        ...regData,
        email: data.email.toLowerCase(),
        password_hash,
        middle_name: data.middle_name || '',
        status: 'pending',
      })
      .select('*, program:programs(id, name, description, start_date, end_date, status)')
      .single();

    if (error) {
      this.throwIfPendingRegistrationsMissing(error);
      throw error;
    }
    return registration;
  }

  /**
   * Get all registrations (admin/staff only)
   */
  async getAllRegistrations(filters?: { status?: string; search?: string }): Promise<PendingRegistration[]> {
    let query = supabaseAdmin
      .from('pending_registrations')
      .select('*, program:programs(id, name, description, start_date, end_date, status)')
      .order('created_at', { ascending: false });

    if (filters?.status) {
      query = query.eq('status', filters.status);
    }

    if (filters?.search) {
      query = query.or(
        `first_name.ilike.%${filters.search}%,last_name.ilike.%${filters.search}%,email.ilike.%${filters.search}%,username.ilike.%${filters.search}%`
      );
    }

    const { data, error } = await query;
    if (error) {
      this.throwIfPendingRegistrationsMissing(error);
      throw error;
    }
    return (data || []).map(r => {
      const { password_hash, ...safe } = r;
      return safe as PendingRegistration;
    });
  }

  /**
   * Get a single registration by ID
   */
  async getRegistrationById(id: string): Promise<PendingRegistration | null> {
    const { data, error } = await supabaseAdmin
      .from('pending_registrations')
      .select('*, program:programs(id, name, description, start_date, end_date, status)')
      .eq('id', id)
      .single();

    if (error && error.code !== 'PGRST116') {
      this.throwIfPendingRegistrationsMissing(error);
      throw error;
    }
    if (!data) return null;
    const { password_hash, ...safe } = data;
    return safe as PendingRegistration;
  }

  /**
   * Approve a registration: create user + trainee account, mark as approved
   */
  async approveRegistration(id: string, reviewerId: string): Promise<{ user: any; trainee: any }> {
    // Fetch full registration (need password_hash)
    const { data: reg, error: fetchError } = await supabaseAdmin
      .from('pending_registrations')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError) {
      this.throwIfPendingRegistrationsMissing(fetchError);
    }

    if (fetchError || !reg) throw new Error('Registration not found');
    if (reg.status !== 'pending') throw new Error(`Registration is already ${reg.status}`);

    // Check again for duplicate email (race condition safety)
    const { data: existingUserByEmail } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('email', reg.email)
      .maybeSingle();

    if (existingUserByEmail) {
      throw new Error('Cannot approve registration: an account with this email already exists.');
    }

    // Check for duplicate username as well.
    const { data: existingUserByUsername } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('username', reg.username)
      .maybeSingle();

    if (existingUserByUsername) {
      throw new Error('Cannot approve registration: this username is already in use.');
    }

    // 1. Create user account
    const { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .insert({
        email: reg.email,
        username: reg.username,
        password_hash: reg.password_hash,
        role: 'trainee',
      })
      .select()
      .single();

    if (userError) throw userError;

    // 2. Create trainee record
    const qrCode = `TRAINEE-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const { data: trainee, error: traineeError } = await supabaseAdmin
      .from('trainees')
      .insert({
        first_name: reg.first_name,
        last_name: reg.last_name,
        middle_name: reg.middle_name || '',
        email: reg.email,
        phone: reg.phone,
        sex: reg.sex,
        birth_date: reg.birth_date,
        birth_place: reg.birth_place,
        civil_status: reg.civil_status,
        province: reg.province,
        municipality: reg.municipality,
        barangay: reg.barangay,
        street: reg.street,
        educational_attainment: reg.educational_attainment,
        course: reg.course,
        year_graduated: reg.year_graduated,
        classification: reg.classification,
        disability: reg.disability || null,
        employment_status: reg.employment_status,
        program_id: reg.program_id,
        qr_code: qrCode,
        status: 'active',
        enrollment_date: new Date().toISOString(),
      })
      .select()
      .single();

    if (traineeError) {
      // Rollback user creation
      await supabaseAdmin.from('users').delete().eq('id', user.id);
      throw traineeError;
    }

    // 3. Create trainee_accounts link (user ↔ trainee)
    const { error: linkError } = await supabaseAdmin
      .from('trainee_accounts')
      .insert({ user_id: user.id, trainee_id: trainee.id });

    if (linkError) {
      // Rollback both user and trainee
      await supabaseAdmin.from('trainees').delete().eq('id', trainee.id);
      await supabaseAdmin.from('users').delete().eq('id', user.id);
      throw linkError;
    }

    // 4. Mark registration as approved
    const { error: reviewUpdateError } = await supabaseAdmin
      .from('pending_registrations')
      .update({ status: 'approved', reviewed_by: reviewerId, reviewed_at: new Date().toISOString() })
      .eq('id', id);

    if (reviewUpdateError) throw reviewUpdateError;

    return { user: { id: user.id, email: user.email, username: user.username, role: user.role }, trainee };
  }

  /**
   * Reject a registration
   */
  async rejectRegistration(id: string, reviewerId: string, reason?: string): Promise<void> {
    const { data: reg, error: fetchError } = await supabaseAdmin
      .from('pending_registrations')
      .select('id, status')
      .eq('id', id)
      .single();

    if (fetchError) {
      this.throwIfPendingRegistrationsMissing(fetchError);
    }

    if (fetchError || !reg) throw new Error('Registration not found');
    if (reg.status !== 'pending') throw new Error(`Registration is already ${reg.status}`);

    const { error } = await supabaseAdmin
      .from('pending_registrations')
      .update({
        status: 'rejected',
        rejection_reason: reason || null,
        reviewed_by: reviewerId,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (error) throw error;
  }

  /**
   * Count pending registrations (for badge indicator)
   */
  async countPending(): Promise<number> {
    const { count, error } = await supabaseAdmin
      .from('pending_registrations')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending');

    if (error) {
      this.throwIfPendingRegistrationsMissing(error);
      throw error;
    }
    return count || 0;
  }
}

export const registrationService = new RegistrationService();
