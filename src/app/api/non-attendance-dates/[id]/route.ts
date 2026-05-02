import { NextRequest, NextResponse } from 'next/server';
import { requireRoleAsync } from '@/middleware/auth';
import { nonAttendanceDateService } from '@/services/nonAttendanceDateService';
import { withErrorHandler } from '@/middleware/errorHandler';
import { successResponse } from '@/utils/responses';
import logger from '@/utils/logger';

/**
 * PUT /api/non-attendance-dates/:id - Update an excluded date
 */
export const PUT = withErrorHandler(async (
  request: NextRequest,
  { params }: { params: { id: string } }
) => {
  const authResult = await requireRoleAsync(request, ['admin']);
  if ('error' in authResult) return authResult.error;

  const id = params.id;
  const body = await request.json();

  const updated = await nonAttendanceDateService.updateNonAttendanceDate(id, body);

  logger.info(`Updated non-attendance date ${id} by ${authResult.user.email}`);

  return successResponse(updated, 'Date updated successfully');
});

/**
 * DELETE /api/non-attendance-dates/:id - Delete an excluded date
 */
export const DELETE = withErrorHandler(async (
  request: NextRequest,
  { params }: { params: { id: string } }
) => {
  const authResult = await requireRoleAsync(request, ['admin']);
  if ('error' in authResult) return authResult.error;

  const id = params.id;

  await nonAttendanceDateService.deleteNonAttendanceDate(id);

  logger.info(`Deleted non-attendance date ${id} by ${authResult.user.email}`);

  return successResponse(null, 'Date deleted successfully');
});
