import { NextRequest } from 'next/server';
import { forgotPasswordSchema } from '@/utils/validators';
import { successResponse } from '@/utils/responses';
import { withErrorHandler } from '@/middleware/errorHandler';
import { handleOptionsRequest } from '@/middleware/cors';
import { checkRateLimit, getRateLimitKey } from '@/utils/rateLimit';
import { authRecoveryService } from '@/services/authRecoveryService';
import { activityLogService } from '@/services/activityLogService';

// OPTIONS /api/auth/forgot-password - Handle CORS preflight
export async function OPTIONS(request: NextRequest) {
  return handleOptionsRequest(request);
}

// POST /api/auth/forgot-password - Create admin-assisted reset request
export const POST = withErrorHandler(async (request: NextRequest) => {
  const rlResponse = checkRateLimit(getRateLimitKey(request, 'forgot-password'), {
    limit: 5,
    windowMs: 60 * 60 * 1000,
  });
  if (rlResponse) return rlResponse;

  const body = await request.json();
  const parsed = forgotPasswordSchema.parse(body);

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('x-real-ip')
    || undefined;
  const userAgent = request.headers.get('user-agent') || undefined;

  const requestRecord = await authRecoveryService.createPasswordResetRequest(parsed.email, {
    ip,
    userAgent,
  });

  if (requestRecord?.requestId) {
    await activityLogService.logAction(
      requestRecord.userId,
      'password_reset_requested',
      'password_reset_request',
      requestRecord.requestId,
      { email: parsed.email }
    );
  }

  return successResponse(
    { submitted: true },
    'If the account exists, a password reset request has been submitted for admin review.'
  );
});
