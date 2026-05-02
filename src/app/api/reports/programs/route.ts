import { NextRequest } from 'next/server';
import { requireAuthAsync } from '@/middleware/auth';
import { successResponse } from '@/utils/responses';
import { withErrorHandler } from '@/middleware/errorHandler';
import { handleOptionsRequest } from '@/middleware/cors';
import { supabaseAdmin } from '@/lib/supabase-admin';

// OPTIONS /api/reports/programs - Handle CORS preflight
export async function OPTIONS(request: NextRequest) {
  return handleOptionsRequest(request);
}

// GET /api/reports/programs - Get program analytics report
export const GET = withErrorHandler(async (request: NextRequest) => {
  const authResult = await requireAuthAsync(request);
  if ('error' in authResult) return authResult.error;

  const { searchParams } = new URL(request.url);
  const startDate = searchParams.get('startDate') || searchParams.get('start_date') || undefined;
  const endDate = searchParams.get('endDate') || searchParams.get('end_date') || undefined;
  const statusFilter = searchParams.get('status') || undefined;

  let programsQuery = supabaseAdmin
    .from('programs')
    .select('id, name, status, max_trainees, start_date, end_date, created_at');

  if (statusFilter) {
    programsQuery = programsQuery.eq('status', statusFilter);
  }
  if (startDate) {
    programsQuery = programsQuery.gte('start_date', startDate);
  }
  if (endDate) {
    programsQuery = programsQuery.lte('start_date', endDate);
  }

  const { data: programs, error: programsError } = await programsQuery.order('start_date', { ascending: false });
  if (programsError) throw programsError;

  const programRows = programs || [];
  const programIds = programRows.map((program) => program.id);

  let traineeRows: Array<{ program_id: string; status: string; enrollment_date: string }> = [];

  if (programIds.length > 0) {
    let traineesQuery = supabaseAdmin
      .from('trainees')
      .select('program_id, status, enrollment_date')
      .in('program_id', programIds);

    if (startDate) {
      traineesQuery = traineesQuery.gte('enrollment_date', startDate);
    }
    if (endDate) {
      traineesQuery = traineesQuery.lte('enrollment_date', endDate);
    }

    const { data, error } = await traineesQuery;
    if (error) throw error;
    traineeRows = data || [];
  }

  const enrolledByProgram: Record<string, number> = {};
  const completedByProgram: Record<string, number> = {};

  for (const trainee of traineeRows) {
    enrolledByProgram[trainee.program_id] = (enrolledByProgram[trainee.program_id] || 0) + 1;
    if (trainee.status === 'completed') {
      completedByProgram[trainee.program_id] = (completedByProgram[trainee.program_id] || 0) + 1;
    }
  }

  const byCategory = programRows.reduce((acc, program) => {
    acc[program.status] = (acc[program.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const totalCapacity = programRows.reduce((sum, program) => sum + (program.max_trainees || 0), 0);
  const totalEnrolled = traineeRows.length;
  const completedPrograms = programRows.filter((program) => program.status === 'completed').length;

  const enrollmentRate = totalCapacity > 0
    ? Number(((totalEnrolled / totalCapacity) * 100).toFixed(2))
    : 0;

  const completionRate = programRows.length > 0
    ? Number(((completedPrograms / programRows.length) * 100).toFixed(2))
    : 0;

  const popularPrograms = [...programRows]
    .map((program) => ({
      id: program.id,
      name: program.name,
      enrolled: enrolledByProgram[program.id] || 0,
    }))
    .sort((a, b) => b.enrolled - a.enrolled)
    .slice(0, 10);

  const programStats = programRows.map((program) => {
    const enrolledCount = enrolledByProgram[program.id] || 0;
    const completedCount = completedByProgram[program.id] || 0;
    const programCompletionRate = enrolledCount > 0
      ? Number(((completedCount / enrolledCount) * 100).toFixed(2))
      : 0;

    return {
      id: program.id,
      name: program.name,
      status: program.status,
      enrolledCount,
      completedCount,
      completionRate: programCompletionRate,
      capacity: program.max_trainees || 0,
      start_date: program.start_date,
      end_date: program.end_date,
    };
  });

  return successResponse({
    totalPrograms: programRows.length,
    enrollmentRate,
    completionRate,
    byCategory,
    popularPrograms,
    programStats,
  });
});
