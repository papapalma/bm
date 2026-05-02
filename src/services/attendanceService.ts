import { supabase, supabaseAdmin } from '@/lib/supabase';
import { nonAttendanceDateService } from './nonAttendanceDateService';

export interface Attendance {
  id: string;
  session_id: string;
  trainee_id: string;
  status: 'present' | 'absent' | 'late' | 'excused';
  check_in_time?: string;
  check_out_time?: string;
  scanned_by?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface AttendanceWithDetails extends Attendance {
  trainee?: {
    id: string;
    first_name: string;
    last_name: string;
    middle_name: string;
    qr_code: string;
    photo_path?: string;
  };
  session?: {
    id: string;
    title: string;
    session_date: string;
    start_time: string;
    end_time: string;
    program_id: string;
  };
}

export interface MarkAttendanceData {
  session_id: string;
  trainee_id: string;
  status: 'present' | 'absent' | 'late' | 'excused';
  scanned_by?: string;
  notes?: string;
}

class AttendanceService {
  async getAttendanceBySession(sessionId: string) {
    const { data, error } = await supabase
      .from('attendance')
      .select(`
        *,
        trainee:trainees(id, first_name, last_name, middle_name, qr_code, photo_path)
      `)
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return data;
  }

  async getAttendanceByTrainee(traineeId: string) {
    const { data, error } = await supabase
      .from('attendance')
      .select(`
        *,
        session:program_sessions(id, title, session_date, start_time, end_time, program_id, program:programs(id, name))
      `)
      .eq('trainee_id', traineeId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  }

  async markAttendance(data: MarkAttendanceData) {
    const attendanceData: any = {
      session_id: data.session_id,
      trainee_id: data.trainee_id,
      status: data.status,
      notes: data.notes ?? null
    };

    if (data.status === 'present' || data.status === 'late') {
      attendanceData.check_in_time = new Date().toISOString();
      attendanceData.check_out_time = null;
    } else {
      attendanceData.check_in_time = null;
      attendanceData.check_out_time = null;
    }

    if (data.scanned_by) {
      attendanceData.scanned_by = data.scanned_by;
    }

    // Use upsert to handle duplicate entries
    const { data: result, error } = await supabaseAdmin
      .from('attendance')
      .upsert(attendanceData, { 
        onConflict: 'session_id,trainee_id',
        ignoreDuplicates: false 
      })
      .select(`
        *,
        trainee:trainees(id, first_name, last_name, middle_name, qr_code, photo_path)
      `)
      .single();

    if (error) throw error;
    return result;
  }

  async markAttendanceByQR(sessionId: string, qrCode: string, scannedBy: string) {
    // First find the trainee by QR code
    const { data: trainee, error: traineeError } = await supabase
      .from('trainees')
      .select('id, first_name, last_name, program_id')
      .eq('qr_code', qrCode)
      .single();

    if (traineeError || !trainee) {
      throw new Error('Trainee not found with this QR code');
    }

    // Check if session exists and get program info
    const { data: session, error: sessionError } = await supabase
      .from('program_sessions')
      .select('id, program_id, session_date, start_time')
      .eq('id', sessionId)
      .single();

    if (sessionError || !session) {
      throw new Error('Session not found');
    }

    // Verify trainee is enrolled in this program
    if (trainee.program_id !== session.program_id) {
      throw new Error('Trainee is not enrolled in this program');
    }

    // Check if late (more than 15 minutes after start time)
    const now = new Date();
    const sessionStart = new Date(`${session.session_date}T${session.start_time}`);
    const isLate = now > new Date(sessionStart.getTime() + 15 * 60 * 1000);

    // Mark attendance
    return this.markAttendance({
      session_id: sessionId,
      trainee_id: trainee.id,
      status: isLate ? 'late' : 'present',
      scanned_by: scannedBy,
      notes: isLate ? 'Marked as late (arrived after 15 minutes)' : undefined
    });
  }

  async checkOut(sessionId: string, traineeId: string) {
    const { data, error } = await supabaseAdmin
      .from('attendance')
      .update({ check_out_time: new Date().toISOString() })
      .eq('session_id', sessionId)
      .eq('trainee_id', traineeId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async bulkMarkAbsent(sessionId: string) {
    // Get all trainees enrolled in the program for this session
    const { data: session, error: sessionError } = await supabase
      .from('program_sessions')
      .select('program_id')
      .eq('id', sessionId)
      .single();

    if (sessionError) throw sessionError;

    const { data: trainees, error: traineesError } = await supabase
      .from('trainees')
      .select('id')
      .eq('program_id', session.program_id)
      .eq('status', 'active');

    if (traineesError) throw traineesError;

    // Get existing attendance records
    const { data: existingAttendance, error: attendanceError } = await supabase
      .from('attendance')
      .select('trainee_id')
      .eq('session_id', sessionId);

    if (attendanceError) throw attendanceError;

    const existingTraineeIds = new Set(existingAttendance?.map(a => a.trainee_id) || []);
    
    // Create absent records for trainees without attendance
    const absentRecords = trainees
      ?.filter(t => !existingTraineeIds.has(t.id))
      .map(t => ({
        session_id: sessionId,
        trainee_id: t.id,
        status: 'absent' as const
      })) || [];

    if (absentRecords.length > 0) {
      const { error: insertError } = await supabaseAdmin
        .from('attendance')
        .insert(absentRecords);

      if (insertError) throw insertError;
    }

    return { markedAbsent: absentRecords.length };
  }

  async getAttendanceStats(programId: string) {
    const { data, error } = await supabase
      .from('attendance')
      .select(`
        status,
        session:program_sessions!inner(program_id, session_date)
      `)
      .eq('session.program_id', programId);

    if (error) throw error;

    // Get excluded dates for this program
    const excludedDates = await nonAttendanceDateService.getAllNonAttendanceDates({
      program_id: programId
    });
    const excludedDateSet = new Set(excludedDates.map(d => d.date));

    // Filter out attendance records on excluded dates
    const validAttendance = data?.filter(a => {
      const sessionDate = (a.session as any).session_date;
      return !excludedDateSet.has(sessionDate);
    }) || [];

    const stats = {
      total: validAttendance.length,
      present: validAttendance.filter(a => a.status === 'present').length,
      absent: validAttendance.filter(a => a.status === 'absent').length,
      late: validAttendance.filter(a => a.status === 'late').length,
      excused: validAttendance.filter(a => a.status === 'excused').length
    };

    return stats;
  }

  async getTraineeAttendanceStats(traineeId: string, programId?: string) {
    const { data, error } = await supabase
      .from('attendance')
      .select(`
        status,
        session:program_sessions!inner(session_date, program_id)
      `)
      .eq('trainee_id', traineeId);

    if (error) throw error;

    // Get excluded dates (program-specific if programId provided)
    const excludedDates = await nonAttendanceDateService.getAllNonAttendanceDates(
      programId ? { program_id: programId } : undefined
    );
    const excludedDateSet = new Set(excludedDates.map(d => d.date));

    // Filter out attendance records on excluded dates
    const validAttendance = data?.filter(a => {
      const session = a.session as any;
      return !excludedDateSet.has(session.session_date);
    }) || [];

    const stats = {
      total: validAttendance.length,
      present: validAttendance.filter(a => a.status === 'present').length,
      absent: validAttendance.filter(a => a.status === 'absent').length,
      late: validAttendance.filter(a => a.status === 'late').length,
      excused: validAttendance.filter(a => a.status === 'excused').length,
      attendanceRate: 0
    };

    if (stats.total > 0) {
      stats.attendanceRate = Math.round(((stats.present + stats.late) / stats.total) * 100);
    }

    return stats;
  }
}

export const attendanceService = new AttendanceService();
