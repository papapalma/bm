import { NextRequest } from 'next/server';
import { traineeService } from '@/services/traineeService';
import { programService } from '@/services/programService';
import { requireRoleAsync } from '@/middleware/auth';
import { withErrorHandler } from '@/middleware/errorHandler';
import { handleOptionsRequest } from '@/middleware/cors';
import { createCsvDownloadResponse, objectsToCsv } from '@/utils/export';

// OPTIONS /api/trainees/export - Handle CORS preflight
export async function OPTIONS(request: NextRequest) {
  return handleOptionsRequest(request);
}

// GET /api/trainees/export - Export trainees as CSV
export const GET = withErrorHandler(async (request: NextRequest) => {
  const authResult = await requireRoleAsync(request, ['admin', 'staff-trainees', 'staff-inventory']);
  if ('error' in authResult) return authResult.error;

  const { searchParams } = new URL(request.url);
  const program_id = searchParams.get('program_id') || searchParams.get('program') || undefined;
  const status = searchParams.get('status') || undefined;
  const search = searchParams.get('search') || undefined;

  const [trainees, programs] = await Promise.all([
    traineeService.getAllTrainees({ program_id, status, search }),
    programService.getAllPrograms(),
  ]);

  const programNameById = new Map(programs.map((program) => [program.id, program.name]));

  const rows = trainees.map((trainee) => ({
    id: trainee.id,
    last_name: trainee.last_name,
    first_name: trainee.first_name,
    middle_name: trainee.middle_name,
    email: trainee.email,
    phone: trainee.phone,
    sex: trainee.sex,
    program: programNameById.get(trainee.program_id) || '',
    status: trainee.status,
    enrollment_date: trainee.enrollment_date,
    municipality: trainee.municipality,
    province: trainee.province,
  }));

  const csv = objectsToCsv(rows, [
    'id',
    'last_name',
    'first_name',
    'middle_name',
    'email',
    'phone',
    'sex',
    'program',
    'status',
    'enrollment_date',
    'municipality',
    'province',
  ]);

  return createCsvDownloadResponse(csv, 'trainees-export.csv');
});
