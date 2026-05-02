import { NextRequest } from 'next/server';
import { lendingService } from '@/services/lendingService';
import { requireAuthAsync } from '@/middleware/auth';
import { successResponse } from '@/utils/responses';
import { withErrorHandler } from '@/middleware/errorHandler';
import { handleOptionsRequest } from '@/middleware/cors';

// OPTIONS /api/lendings/overdue - Handle CORS preflight
export async function OPTIONS(request: NextRequest) {
  return handleOptionsRequest(request);
}

// GET /api/lendings/overdue - Get all overdue lendings
export const GET = withErrorHandler(async (request: NextRequest) => {
  const authResult = await requireAuthAsync(request);
  if ('error' in authResult) return authResult.error;
  
  const overdueLendings = await lendingService.getOverdueLendings();
  
  return successResponse(overdueLendings);
});
