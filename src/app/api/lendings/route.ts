import { NextRequest } from 'next/server';
import { lendingService } from '@/services/lendingService';
import { requireAuthAsync, requireRoleAsync } from '@/middleware/auth';
import { createLendingSchema } from '@/utils/validators';
import { successResponse } from '@/utils/responses';
import { withErrorHandler } from '@/middleware/errorHandler';
import { activityLogService } from '@/services/activityLogService';
import { handleOptionsRequest } from '@/middleware/cors';

// OPTIONS /api/lendings - Handle CORS preflight
export async function OPTIONS(request: NextRequest) {
  return handleOptionsRequest(request);
}

// GET /api/lendings - Get all lendings
export const GET = withErrorHandler(async (request: NextRequest) => {
  const authResult = await requireAuthAsync(request);
  if ('error' in authResult) return authResult.error;
  
  const { searchParams } = new URL(request.url);
  const trainee_id = searchParams.get('trainee_id') || undefined;
  const status = searchParams.get('status') || undefined;
  const start_date = searchParams.get('start_date') || undefined;
  const end_date = searchParams.get('end_date') || undefined;
  
  const lendings = await lendingService.getAllLendings({
    trainee_id,
    status,
    start_date,
    end_date,
  });
  
  return successResponse(lendings);
});

// POST /api/lendings - Create new lending
export const POST = withErrorHandler(async (request: NextRequest) => {
  const authResult = await requireRoleAsync(request, ['admin', 'staff-inventory']);
  if ('error' in authResult) return authResult.error;
  
  const body = await request.json();
  const validatedData = createLendingSchema.parse(body);
  
  const lending = await lendingService.createLending(
    validatedData,
    authResult.user.userId
  );
  
  await activityLogService.logAction(
    authResult.user.userId,
    'create',
    'lending',
    lending.id,
    validatedData
  );
  
  return successResponse(lending, 'Lending created successfully', 201);
});
