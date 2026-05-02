import { NextRequest } from 'next/server';
import { programService } from '@/services/programService';
import { requireRoleAsync } from '@/middleware/auth';
import { createProgramSchema } from '@/utils/validators';
import { successResponse } from '@/utils/responses';
import { withErrorHandler } from '@/middleware/errorHandler';
import { activityLogService } from '@/services/activityLogService';
import { handleOptionsRequest } from '@/middleware/cors';

// OPTIONS /api/programs - Handle CORS preflight
export async function OPTIONS(request: NextRequest) {
  return handleOptionsRequest(request);
}

// GET /api/programs - Get all programs (public endpoint)
export const GET = withErrorHandler(async (request: NextRequest) => {
  // No authentication required - this endpoint is public for the landing page
  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status') || undefined;
  const search = searchParams.get('search') || undefined;
  
  const programs = await programService.getAllPrograms({ status, search });
  
  return successResponse(programs);
});

// POST /api/programs - Create new program
export const POST = withErrorHandler(async (request: NextRequest) => {
  const authResult = await requireRoleAsync(request, ['admin', 'staff-trainees']);
  if ('error' in authResult) return authResult.error;
  
  const body = await request.json();
  const validatedData = createProgramSchema.parse(body);
  
  const program = await programService.createProgram(validatedData);
  
  await activityLogService.logAction(
    authResult.user.userId,
    'create',
    'program',
    program.id,
    validatedData
  );
  
  return successResponse(program, 'Program created successfully', 201);
});
