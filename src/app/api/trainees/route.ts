import { NextRequest } from 'next/server';
import { traineeService } from '@/services/traineeService';
import { requireAuthAsync, requireRoleAsync } from '@/middleware/auth';
import { createTraineeSchema } from '@/utils/validators';
import { successResponse } from '@/utils/responses';
import { withErrorHandler } from '@/middleware/errorHandler';
import { activityLogService } from '@/services/activityLogService';
import { handleOptionsRequest } from '@/middleware/cors';

// OPTIONS /api/trainees - Handle CORS preflight
export async function OPTIONS(request: NextRequest) {
  return handleOptionsRequest(request);
}

// GET /api/trainees - Get all trainees
export const GET = withErrorHandler(async (request: NextRequest) => {
  const authResult = await requireAuthAsync(request);
  if ('error' in authResult) return authResult.error;
  
  const { searchParams } = new URL(request.url);
  const program_id = searchParams.get('program_id') || undefined;
  const status = searchParams.get('status') || undefined;
  const search = searchParams.get('search') || undefined;
  
  const trainees = await traineeService.getAllTrainees({ program_id, status, search });
  
  return successResponse(trainees);
});

// POST /api/trainees - Create new trainee
export const POST = withErrorHandler(async (request: NextRequest) => {
  const authResult = await requireRoleAsync(request, ['admin', 'staff-trainees']);
  if ('error' in authResult) return authResult.error;
  
  const body = await request.json();
  const validatedData = createTraineeSchema.parse(body);
  
  const { trainee: traineeRecord, temp_password } = await traineeService.createTrainee(validatedData);

  // Strip PII before storing in activity log (SEC-18)
  const { email: _e, phone: _p, birth_date: _b, street: _s, province: _pr, municipality: _m, barangay: _ba, ...safeLogData } = validatedData;
  await activityLogService.logAction(
    authResult.user.userId,
    'create',
    'trainee',
    traineeRecord.id,
    { ...safeLogData, program_id: validatedData.program_id }
  );

  return successResponse(
    { ...traineeRecord, temp_password },
    'Trainee created successfully',
    201
  );
});
