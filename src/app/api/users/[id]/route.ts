import { NextRequest } from 'next/server';
import { supabase } from '@/lib/supabase';
import { hashPassword } from '@/lib/auth';
import { successResponse, errorResponse, noContentResponse } from '@/utils/responses';
import { requireRoleAsync } from '@/middleware/auth';
import { withErrorHandler } from '@/middleware/errorHandler';
import { handleOptionsRequest } from '@/middleware/cors';
import { z } from 'zod';

// OPTIONS /api/users/[id] - Handle CORS preflight
export async function OPTIONS(request: NextRequest) {
  return handleOptionsRequest(request);
}

const updateUserSchema = z.object({
  email: z.string().email().max(255).toLowerCase().trim().optional(),
  username: z.string().min(3).max(100).trim().optional(),
  password: z.string().min(6).max(100).optional(),
  role: z.enum(['admin', 'staff-inventory', 'staff-trainees', 'trainee']).optional(),
});

/**
 * GET /api/users/[id]
 * Get a single user by ID (admin only)
 */
export const GET = withErrorHandler(async (request: NextRequest, { params }: { params: { id: string } }) => {
  const authResult = await requireRoleAsync(request, ['admin']);
  if ('error' in authResult) return authResult.error;

  const id = params.id;

  const { data: user, error } = await supabase
    .from('users')
    .select('id, email, username, role, created_at, updated_at')
    .eq('id', id)
    .single();

  if (error || !user) {
    return errorResponse('User not found', 404);
  }

  return successResponse(user);
});

/**
 * PUT /api/users/[id]
 * Update a user (admin only)
 */
export const PUT = withErrorHandler(async (request: NextRequest, { params }: { params: { id: string } }) => {
  const authResult = await requireRoleAsync(request, ['admin']);
  if ('error' in authResult) return authResult.error;

  const id = params.id;
  const body = await request.json();
  const validatedData = updateUserSchema.parse(body);

  // Check if user exists
  const { data: existingUser } = await supabase
    .from('users')
    .select('id')
    .eq('id', id)
    .single();

  if (!existingUser) {
    return errorResponse('User not found', 404);
  }

  // If email is being changed, check if new email already exists
  if (validatedData.email) {
    const { data: emailUser } = await supabase
      .from('users')
      .select('id')
      .eq('email', validatedData.email)
      .neq('id', id)
      .single();

    if (emailUser) {
      return errorResponse('Email already in use', 409);
    }
  }

  // Prepare update data
  const updateData: any = {};
  if (validatedData.email) updateData.email = validatedData.email;
  if (validatedData.username) updateData.username = validatedData.username;
  if (validatedData.role) updateData.role = validatedData.role;
  
  // Hash password if provided
  if (validatedData.password) {
    updateData.password_hash = await hashPassword(validatedData.password);
  }

  // Update user
  const { data: user, error } = await supabase
    .from('users')
    .update(updateData)
    .eq('id', id)
    .select('id, email, username, role, created_at, updated_at')
    .single();

  if (error) {
    throw error;
  }

  return successResponse(user);
});

/**
 * DELETE /api/users/[id]
 * Delete a user (admin only)
 */
export const DELETE = withErrorHandler(async (request: NextRequest, { params }: { params: { id: string } }) => {
  const authResult = await requireRoleAsync(request, ['admin']);
  if ('error' in authResult) return authResult.error;

  const id = params.id;

  // Check if user exists
  const { data: existingUser } = await supabase
    .from('users')
    .select('id, email')
    .eq('id', id)
    .single();

  if (!existingUser) {
    return errorResponse('User not found', 404);
  }

  // Prevent deleting main admin
  if (existingUser.email === 'admin@bmdc.edu.ph') {
    return errorResponse('Cannot delete the main admin account', 403);
  }

  // Delete user
  const { error } = await supabase
    .from('users')
    .delete()
    .eq('id', id);

  if (error) {
    throw error;
  }

  return noContentResponse();
});
