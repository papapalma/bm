import { NextRequest } from 'next/server';
import { resetPasswordSchema } from '@/utils/validators';
import { successResponse } from '@/utils/responses';
import { withErrorHandler } from '@/middleware/errorHandler';
import { handleOptionsRequest } from '@/middleware/cors';
import { checkRateLimit, getRateLimitKey } from '@/utils/rateLimit';
import { authRecoveryService } from '@/services/authRecoveryService';
import { activityLogService } from '@/services/activityLogService';

// OPTIONS /api/auth/reset-password - Handle CORS preflight
export async function OPTIONS(request: NextRequest) {
  return handleOptionsRequest(request);
}

// POST /api/auth/reset-password - Reset password using approved admin-issued token
export const POST = withErrorHandler(async (request: NextRequest) => {
  const rlResponse = checkRateLimit(getRateLimitKey(request, 'reset-password'), {
    limit: 10,
    windowMs: 60 * 60 * 1000,
  });
  if (rlResponse) return rlResponse;

  const body = await request.json();
  const parsed = resetPasswordSchema.parse(body);

  const userId = await authRecoveryService.resetPasswordWithApprovedToken(
    parsed.token,
    parsed.newPassword
  );

  await activityLogService.logAction(
    userId,
    'password_reset_completed',
    'user',
    userId
  );

  return successResponse(null, 'Password reset successful. You can now log in with your new password.');
});
