import { NextRequest } from 'next/server';
import { supabase } from '@/lib/supabase';
import { hashPassword, generateToken } from '@/lib/auth';
import { registerSchema } from '@/utils/validators';
import { requireRoleAsync } from '@/middleware/auth';
import { createdResponse, errorResponse } from '@/utils/responses';
import { withErrorHandler } from '@/middleware/errorHandler';
import { activityLogService } from '@/services/activityLogService';
import { handleOptionsRequest } from '@/middleware/cors';
import { checkRateLimit, getRateLimitKey } from '@/utils/rateLimit';

// OPTIONS /api/auth/register - Handle CORS preflight
export async function OPTIONS(request: NextRequest) {
  return handleOptionsRequest(request);
}

export const POST = withErrorHandler(async (request: NextRequest) => {
  // Rate limit: 20 registrations per IP per hour (SEC-6)
  const rlResponse = checkRateLimit(getRateLimitKey(request, 'register'), { limit: 20, windowMs: 60 * 60 * 1000 });
  if (rlResponse) return rlResponse;

  // Only admins can create new staff/admin accounts
  const authResult = await requireRoleAsync(request, ['admin']);
  if ('error' in authResult) return authResult.error;

  const body = await request.json();
  const validatedData = registerSchema.parse(body);
  
  // Check if user already exists
  const { data: existingUser } = await supabase
    .from('users')
    .select('id')
    .eq('email', validatedData.email)
    .single();
  
  if (existingUser) {
    return errorResponse('User with this email already exists', 409);
  }
  
  // Hash password
  const passwordHash = await hashPassword(validatedData.password);
  
  // Create user
  const { data: user, error } = await supabase
    .from('users')
    .insert({
      email: validatedData.email,
      username: validatedData.username,
      password_hash: passwordHash,
      role: validatedData.role ?? 'staff-inventory',
    })
    .select()
    .single();
  
  if (error) {
    throw error;
  }
  
  // Generate token
  const token = generateToken({
    userId: user.id,
    email: user.email,
    role: user.role,
  });
  
  // Log activity
  await activityLogService.logAction(
    user.id,
    'register',
    'user',
    user.id
  );
  
  return createdResponse({
    token,
    user: {
      id: user.id,
      email: user.email,
      username: user.username,
      role: user.role,
    },
  }, 'User registered successfully');
});
