import { NextRequest } from 'next/server';
import { lendingService } from '@/services/lendingService';
import { requireAuthAsync } from '@/middleware/auth';
import { successResponse, notFoundResponse } from '@/utils/responses';
import { withErrorHandler } from '@/middleware/errorHandler';
import { handleOptionsRequest } from '@/middleware/cors';

// OPTIONS /api/lendings/:id - Handle CORS preflight
export async function OPTIONS(request: NextRequest) {
  return handleOptionsRequest(request);
}
// GET /api/lendings/:id - Get lending by ID
export const GET = withErrorHandler(
  async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;
    const authResult = await requireAuthAsync(request);
    if ('error' in authResult) return authResult.error;
    
    const lending = await lendingService.getLendingById(id);
    
    if (!lending) {
      return notFoundResponse('Lending not found');
    }
    
    return successResponse(lending);
  }
);
