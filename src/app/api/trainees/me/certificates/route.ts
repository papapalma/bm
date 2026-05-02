import { NextRequest } from 'next/server';
import { supabase } from '@/lib/supabase';
import { requireRoleAsync } from '@/middleware/auth';
import { successResponse, notFoundResponse } from '@/utils/responses';
import { withErrorHandler } from '@/middleware/errorHandler';
import { handleOptionsRequest } from '@/middleware/cors';

// OPTIONS /api/trainees/me/certificates - Handle CORS preflight
export async function OPTIONS(request: NextRequest) {
  return handleOptionsRequest(request);
}

/**
 * GET /api/trainees/me/certificates
 * Get certificates for the current trainee (trainee role only)
 */
export const GET = withErrorHandler(async (request: NextRequest) => {
  const authResult = await requireRoleAsync(request, ['trainee']);
  if ('error' in authResult) return authResult.error;

  const userId = authResult.user.userId;

  // Get trainee data with certificates
  const { data: traineeAccount, error: accountError } = await supabase
    .from('trainee_accounts')
    .select(`
      trainee_id,
      trainees (
        id,
        first_name,
        last_name,
        certificates
      )
    `)
    .eq('user_id', userId)
    .single();

  if (accountError || !traineeAccount) {
    return notFoundResponse('Trainee profile not found for this user');
  }

  const traineeData = traineeAccount.trainees as any;
  const certificates = traineeData.certificates || [];

  return successResponse({
    trainee_id: traineeData.id,
    trainee_name: `${traineeData.first_name} ${traineeData.last_name}`,
    certificates,
  });
});
