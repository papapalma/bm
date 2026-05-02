import { NextRequest } from 'next/server';
import { registrationService } from '@/services/registrationService';
import { requireRoleAsync } from '@/middleware/auth';
import { reviewRegistrationSchema } from '@/utils/validators';
import { successResponse, errorResponse } from '@/utils/responses';
import { withErrorHandler } from '@/middleware/errorHandler';
import { activityLogService } from '@/services/activityLogService';
import { handleOptionsRequest } from '@/middleware/cors';

// OPTIONS /api/registrations/[id]
export async function OPTIONS(request: NextRequest) {
  return handleOptionsRequest(request);
}

// GET /api/registrations/[id] - Get a single registration
export const GET = withErrorHandler(async (request: NextRequest, { params }: { params: { id: string } }) => {
  const authResult = await requireRoleAsync(request, ['admin', 'staff-trainees', 'staff-inventory']);
  if ('error' in authResult) return authResult.error;

  const registration = await registrationService.getRegistrationById(params.id);
  if (!registration) return errorResponse('Registration not found', 404);

  return successResponse(registration);
});

// PATCH /api/registrations/[id] - Approve or reject a registration
export const PATCH = withErrorHandler(async (request: NextRequest, { params }: { params: { id: string } }) => {
  const authResult = await requireRoleAsync(request, ['admin', 'staff-trainees']);
  if ('error' in authResult) return authResult.error;

  const body = await request.json();
  const { action, rejection_reason } = reviewRegistrationSchema.parse(body);

  if (action === 'approve') {
    const result = await registrationService.approveRegistration(params.id, authResult.user.userId);

    await activityLogService.logAction(
      authResult.user.userId,
      'approve_registration',
      'trainee',
      result.trainee.id,
      { registration_id: params.id }
    );

    return successResponse(result, 'Registration approved. Trainee account created successfully.');
  } else {
    await registrationService.rejectRegistration(params.id, authResult.user.userId, rejection_reason);

    await activityLogService.logAction(
      authResult.user.userId,
      'reject_registration',
      'trainee',
      params.id,
      { rejection_reason }
    );

    return successResponse(null, 'Registration rejected.');
  }
});
