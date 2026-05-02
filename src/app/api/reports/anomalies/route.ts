import { NextRequest } from 'next/server';
import { anomalyService } from '@/services/anomalyService';
import { requireAuthAsync } from '@/middleware/auth';
import { successResponse } from '@/utils/responses';
import { withErrorHandler } from '@/middleware/errorHandler';
import { handleOptionsRequest } from '@/middleware/cors';

// OPTIONS /api/reports/anomalies - Handle CORS preflight
export async function OPTIONS(request: NextRequest) {
  return handleOptionsRequest(request);
}

// GET /api/reports/anomalies - Get anomalies report
export const GET = withErrorHandler(async (request: NextRequest) => {
  const authResult = await requireAuthAsync(request);
  if ('error' in authResult) return authResult.error;
  
  const { searchParams } = new URL(request.url);
  const start_date = searchParams.get('start_date') || undefined;
  const end_date = searchParams.get('end_date') || undefined;
  
  const stats = await anomalyService.getAnomalyStats();
  
  return successResponse(stats);
});
