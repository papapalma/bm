import { NextRequest } from 'next/server';
import { attendanceService } from '@/services/attendanceService';
import { requireRoleAsync } from '@/middleware/auth';
import { successResponse, errorResponse } from '@/utils/responses';
import { withErrorHandler } from '@/middleware/errorHandler';
import { activityLogService } from '@/services/activityLogService';
import { handleOptionsRequest } from '@/middleware/cors';
import { z } from 'zod';

// Validation schemas
const markAttendanceSchema = z.object({
  session_id: z.string().uuid('Invalid session ID'),
  trainee_id: z.string().uuid('Invalid trainee ID'),
  status: z.enum(['present', 'absent', 'late', 'excused']),
  notes: z.string().optional(),
});

const scanAttendanceSchema = z.object({
  session_id: z.string().uuid('Invalid session ID'),
  qr_code: z.string().min(1, 'QR code is required'),
});

const bulkMarkAbsentSchema = z.object({
  session_id: z.string().uuid('Invalid session ID'),
});

// OPTIONS /api/attendance
export async function OPTIONS(request: NextRequest) {
  return handleOptionsRequest(request);
}

// GET /api/attendance - Get attendance records
export const GET = withErrorHandler(async (request: NextRequest) => {
  const authResult = await requireRoleAsync(request, ['admin', 'staff-trainees', 'staff-inventory']);
  if ('error' in authResult) return authResult.error;

  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get('session_id');
  const traineeId = searchParams.get('trainee_id');
  const programId = searchParams.get('program_id');
  const stats = searchParams.get('stats');

  // Get stats for a program
  if (stats === 'true' && programId) {
    const attendanceStats = await attendanceService.getAttendanceStats(programId);
    return successResponse(attendanceStats);
  }

  // Get stats for a trainee
  if (stats === 'true' && traineeId) {
    const traineeStats = await attendanceService.getTraineeAttendanceStats(traineeId);
    return successResponse(traineeStats);
  }

  // Get attendance by session
  if (sessionId) {
    const attendance = await attendanceService.getAttendanceBySession(sessionId);
    return successResponse(attendance);
  }

  // Get attendance by trainee
  if (traineeId) {
    const attendance = await attendanceService.getAttendanceByTrainee(traineeId);
    return successResponse(attendance);
  }

  return errorResponse('Please provide session_id or trainee_id parameter');
});

// POST /api/attendance - Mark attendance
export const POST = withErrorHandler(async (request: NextRequest) => {
  const authResult = await requireRoleAsync(request, ['admin', 'staff-trainees']);
  if ('error' in authResult) return authResult.error;

  const body = await request.json();
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');

  // Scan QR code to mark attendance
  if (action === 'scan') {
    const validatedData = scanAttendanceSchema.parse(body);
    
    try {
      const attendance = await attendanceService.markAttendanceByQR(
        validatedData.session_id,
        validatedData.qr_code,
        authResult.user.userId
      );

      await activityLogService.logAction(
        authResult.user.userId,
        'scan_attendance',
        'attendance',
        attendance.id,
        { session_id: validatedData.session_id, qr_code: validatedData.qr_code }
      );

      return successResponse(attendance, 'Attendance marked successfully');
    } catch (error: any) {
      return errorResponse(error.message || 'Failed to mark attendance', 400);
    }
  }

  // Bulk mark absent
  if (action === 'bulk_absent') {
    const validatedData = bulkMarkAbsentSchema.parse(body);
    const result = await attendanceService.bulkMarkAbsent(validatedData.session_id);

    await activityLogService.logAction(
      authResult.user.userId,
      'bulk_mark_absent',
      'attendance',
      validatedData.session_id,
      { session_id: validatedData.session_id, count: result.markedAbsent }
    );

    return successResponse(result, `Marked ${result.markedAbsent} trainees as absent`);
  }

  // Manual attendance marking
  const validatedData = markAttendanceSchema.parse(body);
  const attendance = await attendanceService.markAttendance({
    ...validatedData,
    scanned_by: authResult.user.userId
  });

  await activityLogService.logAction(
    authResult.user.userId,
    'mark_attendance',
    'attendance',
    attendance.id,
    validatedData
  );

  return successResponse(attendance, 'Attendance marked successfully');
});
