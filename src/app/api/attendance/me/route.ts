import { NextRequest } from 'next/server';
import { attendanceService } from '@/services/attendanceService';
import { requireRoleAsync } from '@/middleware/auth';
import { successResponse, notFoundResponse } from '@/utils/responses';
import { withErrorHandler } from '@/middleware/errorHandler';
import { handleOptionsRequest } from '@/middleware/cors';
import { supabase } from '@/lib/supabase';

// OPTIONS /api/attendance/me - Handle CORS preflight
export async function OPTIONS(request: NextRequest) {
  return handleOptionsRequest(request);
}

/**
 * GET /api/attendance/me
 * Get the current trainee's attendance records and stats
 */
export const GET = withErrorHandler(async (request: NextRequest) => {
  const authResult = await requireRoleAsync(request, ['trainee']);
  if ('error' in authResult) return authResult.error;

  const userId = authResult.user.userId;
  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type') || 'records'; // 'records' or 'stats'

  // Get trainee_id from trainee_accounts table
  const { data: traineeAccount, error: accountError } = await supabase
    .from('trainee_accounts')
    .select('trainee_id')
    .eq('user_id', userId)
    .single();

  if (accountError || !traineeAccount) {
    return notFoundResponse('Trainee profile not found for this user');
  }

  const traineeId = traineeAccount.trainee_id;

  if (type === 'stats') {
    // Get attendance statistics
    const stats = await attendanceService.getTraineeAttendanceStats(traineeId);
    return successResponse(stats);
  } else {
    // Get attendance records
    const attendance = await attendanceService.getAttendanceByTrainee(traineeId);
    return successResponse(attendance);
  }
});
