import { NextRequest } from 'next/server';
import { programService } from '@/services/programService';
import { requireRoleAsync } from '@/middleware/auth';
import { updateProgramSchema } from '@/utils/validators';
import { successResponse, notFoundResponse, noContentResponse } from '@/utils/responses';
import { withErrorHandler } from '@/middleware/errorHandler';
import { activityLogService } from '@/services/activityLogService';
import { handleOptionsRequest } from '@/middleware/cors';

// OPTIONS /api/programs/:id - Handle CORS preflight
export async function OPTIONS(request: NextRequest) {
  return handleOptionsRequest(request);
}

// GET /api/programs/:id - Get program by ID (public endpoint)
export const GET = withErrorHandler(
  async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    // No authentication required - this endpoint is public for the landing page
    const { id } = await params;
    const program = await programService.getProgramById(id);
    
    if (!program) {
      return notFoundResponse('Program not found');
    }
    
    return successResponse(program);
  }
);

// PUT /api/programs/:id - Update program
export const PUT = withErrorHandler(
  async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;
    const authResult = await requireRoleAsync(request, ['admin', 'staff-trainees']);
    if ('error' in authResult) return authResult.error;
    
    const body = await request.json();
    const validatedData = updateProgramSchema.parse(body);
    
    const program = await programService.updateProgram(id, validatedData);
    
    await activityLogService.logAction(
      authResult.user.userId,
      'update',
      'program',
      id,
      validatedData
    );
    
    return successResponse(program, 'Program updated successfully');
  }
);

// DELETE /api/programs/:id - Delete program
export const DELETE = withErrorHandler(
  async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;
    const authResult = await requireRoleAsync(request, ['admin']);
    if ('error' in authResult) return authResult.error;
    
    await programService.deleteProgram(id);
    
    await activityLogService.logAction(
      authResult.user.userId,
      'delete',
      'program',
      id
    );
    
    return noContentResponse();
  }
);
