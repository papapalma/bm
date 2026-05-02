import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { generateToken, comparePassword } from '@/lib/auth';
import { loginSchema } from '@/utils/validators';
import { successResponse, errorResponse, createdResponse, unauthorizedResponse } from '@/utils/responses';
import { withErrorHandler } from '@/middleware/errorHandler';
import { activityLogService } from '@/services/activityLogService';
import { handleOptionsRequest } from '@/middleware/cors';
import { checkRateLimit, getRateLimitKey } from '@/utils/rateLimit';
import { authRecoveryService } from '@/services/authRecoveryService';

// OPTIONS /api/auth/login - Handle CORS preflight
export async function OPTIONS(request: NextRequest) {
  return handleOptionsRequest(request);
}

export const POST = withErrorHandler(async (request: NextRequest) => {
  // Rate limit: 10 attempts per IP per 15 minutes (SEC-6)
  const rlResponse = checkRateLimit(getRateLimitKey(request, 'login'), { limit: 10, windowMs: 15 * 60 * 1000 });
  if (rlResponse) return rlResponse;

  const body = await request.json();
  const validatedData = loginSchema.parse(body);
  
  // Find user by email
  const { data: user, error } = await supabase
    .from('users')
    .select('*')
    .eq('email', validatedData.email)
    .single();
  
  if (error || !user) {
    return unauthorizedResponse('Invalid email or password');
  }
  
  // Verify password
  const isPasswordValid = await comparePassword(
    validatedData.password,
    user.password_hash
  );
  
  if (!isPasswordValid) {
    return unauthorizedResponse('Invalid email or password');
  }
  
  // Generate token
  const token = generateToken({
    userId: user.id,
    email: user.email,
    role: user.role,
  });

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('x-real-ip')
    || undefined;
  const userAgent = request.headers.get('user-agent') || undefined;

  const refresh = await authRecoveryService.issueRefreshToken(user.id, { ip, userAgent });
  
  // Log activity
  await activityLogService.logAction(
    user.id,
    'login',
    'user',
    user.id
  );

  const isProduction = process.env.NODE_ENV === 'production';
  const tokenMaxAge = 60 * 60 * 2; // 2 hours in seconds
  const refreshTokenMaxAge = Number(process.env.REFRESH_TOKEN_EXPIRES_DAYS || 14) * 24 * 60 * 60;

  const response = NextResponse.json({
    success: true,
    data: {
      token,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        role: user.role,
      },
    },
    message: 'Login successful',
  });

  // Set HttpOnly cookie so the token is never exposed to JavaScript (SEC-4)
  response.cookies.set('auth_token', token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'strict',
    maxAge: tokenMaxAge,
    path: '/',
  });

  response.cookies.set('refresh_token', refresh.token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'strict',
    maxAge: refreshTokenMaxAge,
    path: '/',
  });

  return response;
});
