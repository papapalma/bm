import { NextRequest } from 'next/server';
import { traineeService } from '@/services/traineeService';
import { requireRoleAsync } from '@/middleware/auth';
import { updateTraineeSchema } from '@/utils/validators';
import { successResponse, notFoundResponse, noContentResponse, errorResponse } from '@/utils/responses';
import { withErrorHandler } from '@/middleware/errorHandler';
import { activityLogService } from '@/services/activityLogService';
import { handleOptionsRequest } from '@/middleware/cors';

// OPTIONS /api/trainees/:id - Handle CORS preflight
export async function OPTIONS(request: NextRequest) {
  return handleOptionsRequest(request);
}

// GET /api/trainees/:id - Get trainee by ID
export const GET = withErrorHandler(
  async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const authResult = await requireRoleAsync(request, ['admin', 'staff-trainees', 'staff-inventory']);
    if ('error' in authResult) return authResult.error;

    const { id } = await params;
    const trainee = await traineeService.getTraineeById(id);
    
    if (!trainee) {
      return notFoundResponse('Trainee not found');
    }
    
    return successResponse(trainee);
  }
);

// PUT /api/trainees/:id - Update trainee
export const PUT = withErrorHandler(
  async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;
    const authResult = await requireRoleAsync(request, ['admin', 'staff-trainees', 'staff-inventory']);
    if ('error' in authResult) return authResult.error;
    
    const body = await request.json();
    
    try {
      const validatedData = updateTraineeSchema.parse(body) as Record<string, any>;

      if (Object.prototype.hasOwnProperty.call(validatedData, 'email') && typeof validatedData.email === 'string') {
        const incomingEmail = validatedData.email.trim().toLowerCase();

        if (authResult.user.role !== 'admin') {
          const existingTrainee = await traineeService.getTraineeById(id);
          if (!existingTrainee) {
            return notFoundResponse('Trainee not found');
          }

          const existingEmail = String(existingTrainee.email || '').trim().toLowerCase();
          if (incomingEmail !== existingEmail) {
            return errorResponse('Only admin can change trainee email', 403);
          }

          // Non-admin updates should never write email, even when unchanged.
          delete validatedData.email;
        }
      }
      
      const trainee = await traineeService.updateTrainee(id, validatedData);
      
      // Strip PII before storing in activity log (SEC-18)
      try {
        const { email: _e, phone: _p, birth_date: _b, street: _s, province: _pr, municipality: _m, barangay: _ba, ...safeLog } = validatedData as any;
        await activityLogService.logAction(
          authResult.user.userId,
          'update',
          'trainee',
          id,
          safeLog
        );
      } catch (logError) {
        // Non-critical
      }
      
      return successResponse(trainee, 'Trainee updated successfully');
    } catch (error) {
      throw error;
    }
  }
);

// DELETE /api/trainees/:id - Delete trainee
export const DELETE = withErrorHandler(
  async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;
    const authResult = await requireRoleAsync(request, ['admin']);
    if ('error' in authResult) return authResult.error;
    
    await traineeService.deleteTrainee(id);
    
    await activityLogService.logAction(
      authResult.user.userId,
      'delete',
      'trainee',
      id
    );
    
    return noContentResponse();
  }
);
