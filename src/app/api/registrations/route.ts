import { NextRequest } from 'next/server';
import { registrationService } from '@/services/registrationService';
import { requireRoleAsync } from '@/middleware/auth';
import { traineeRegistrationSchema } from '@/utils/validators';
import { successResponse, createdResponse } from '@/utils/responses';
import { withErrorHandler } from '@/middleware/errorHandler';
import { handleOptionsRequest } from '@/middleware/cors';

// OPTIONS /api/registrations
export async function OPTIONS(request: NextRequest) {
  return handleOptionsRequest(request);
}

// GET /api/registrations - List registrations (admin/staff-trainees only)
export const GET = withErrorHandler(async (request: NextRequest) => {
  const authResult = await requireRoleAsync(request, ['admin', 'staff-trainees', 'staff-inventory']);
  if ('error' in authResult) return authResult.error;

  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status') || undefined;
  const search = searchParams.get('search') || undefined;

  const registrations = await registrationService.getAllRegistrations({ status, search });
  return successResponse(registrations);
});

// POST /api/registrations - Submit a new registration (PUBLIC - no auth required)
export const POST = withErrorHandler(async (request: NextRequest) => {
  const body = await request.json();
  const validatedData = traineeRegistrationSchema.parse(body);

  const registration = await registrationService.submitRegistration(validatedData);

  // Omit password_hash from response
  const { ...safeReg } = registration as any;
  delete safeReg.password_hash;

  return createdResponse(
    safeReg,
    'Registration submitted successfully. Please wait for admin approval before logging in.'
  );
});
