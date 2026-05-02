import { NextRequest } from 'next/server';
import { requireAuthAsync } from '@/middleware/auth';
import { successResponse } from '@/utils/responses';
import { withErrorHandler } from '@/middleware/errorHandler';
import { handleOptionsRequest } from '@/middleware/cors';
import { supabaseAdmin } from '@/lib/supabase-admin';

// OPTIONS /api/reports/trainees - Handle CORS preflight
export async function OPTIONS(request: NextRequest) {
  return handleOptionsRequest(request);
}

// GET /api/reports/trainees - Get trainee analytics report
export const GET = withErrorHandler(async (request: NextRequest) => {
  const authResult = await requireAuthAsync(request);
  if ('error' in authResult) return authResult.error;

  const { searchParams } = new URL(request.url);
  const startDate = searchParams.get('startDate') || searchParams.get('start_date') || undefined;
  const endDate = searchParams.get('endDate') || searchParams.get('end_date') || undefined;
  const programId = searchParams.get('program') || searchParams.get('program_id') || undefined;
  const status = searchParams.get('status') || undefined;

  let traineesQuery = supabaseAdmin
    .from('trainees')
    .select('id, program_id, status, enrollment_date, created_at');

  if (programId) {
    traineesQuery = traineesQuery.eq('program_id', programId);
  }
  if (status) {
    traineesQuery = traineesQuery.eq('status', status);
  }
  if (startDate) {
    traineesQuery = traineesQuery.gte('enrollment_date', startDate);
  }
  if (endDate) {
    traineesQuery = traineesQuery.lte('enrollment_date', endDate);
  }

  const [{ data: trainees, error: traineesError }, { data: programs, error: programsError }] = await Promise.all([
    traineesQuery.order('enrollment_date', { ascending: true }),
    supabaseAdmin.from('programs').select('id, name'),
  ]);

  if (traineesError) throw traineesError;
  if (programsError) throw programsError;

  const traineeRows = trainees || [];
  const programRows = programs || [];
  const programNameById: Map<string, string> = new Map(programRows.map((program) => [(program.id as unknown) as string, (program.name as unknown) as string] as [string, string]));

  const byProgram: Record<string, number> = {};
  const byStatus: Record<string, number> = {};
  const trendMap: Record<string, number> = {};

  for (const trainee of traineeRows) {
    const programName: string = programNameById.get((trainee.program_id as unknown) as string) || 'Unknown Program';
    byProgram[programName] = (byProgram[programName] || 0) + 1;

    const statusStr = String(trainee.status);
    byStatus[statusStr] = (byStatus[statusStr] || 0) + 1;

    const dateKey = (trainee.enrollment_date || trainee.created_at || '').split('T')[0] || 'unknown';
    trendMap[dateKey] = (trendMap[dateKey] || 0) + 1;
  }

  const enrollmentTrend = Object.entries(trendMap)
    .filter(([date]) => date !== 'unknown')
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, count]) => ({ date, count }));

  const completedCount = byStatus.completed || 0;
  const completionRate = traineeRows.length > 0
    ? Number(((completedCount / traineeRows.length) * 100).toFixed(2))
    : 0;

  return successResponse({
    totalTrainees: traineeRows.length,
    byProgram,
    byStatus,
    enrollmentTrend,
    completionRate,
  });
});
