import { NextRequest } from 'next/server';
import { requireAuthAsync } from '@/middleware/auth';
import { successResponse } from '@/utils/responses';
import { withErrorHandler } from '@/middleware/errorHandler';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { handleOptionsRequest } from '@/middleware/cors';

// OPTIONS /api/trainees/stats - Handle CORS preflight
export async function OPTIONS(request: NextRequest) {
  return handleOptionsRequest(request);
}

// GET /api/trainees/stats - Get trainee statistics
export const GET = withErrorHandler(async (request: NextRequest) => {
  const authResult = await requireAuthAsync(request);
  if ('error' in authResult) return authResult.error;

  const [traineesResult, programsResult] = await Promise.all([
    supabaseAdmin.from('trainees').select('id, status, program_id'),
    supabaseAdmin.from('programs').select('id, name'),
  ]);

  if (traineesResult.error) throw traineesResult.error;
  if (programsResult.error) throw programsResult.error;

  const trainees = traineesResult.data || [];
  const programs = programsResult.data || [];
  const programNameById = new Map(programs.map((program) => [program.id, program.name]));

  const byProgram: Record<string, number> = {};
  trainees.forEach((trainee) => {
    const key = trainee.program_id ? (programNameById.get(trainee.program_id) || 'Unknown Program') : 'Unassigned';
    byProgram[key] = (byProgram[key] || 0) + 1;
  });

  return successResponse({
    totalTrainees: trainees.length,
    active: trainees.filter((trainee) => trainee.status === 'active').length,
    inactive: trainees.filter((trainee) => trainee.status === 'inactive').length,
    completed: trainees.filter((trainee) => trainee.status === 'completed').length,
    dropped: trainees.filter((trainee) => trainee.status === 'dropped').length,
    byProgram,
  });
});
