import { NextRequest } from 'next/server';
import { sessionService } from '@/services/sessionService';
import { requireAuthAsync, requireRoleAsync } from '@/middleware/auth';
import { successResponse } from '@/utils/responses';
import { withErrorHandler } from '@/middleware/errorHandler';
import { activityLogService } from '@/services/activityLogService';
import { handleOptionsRequest } from '@/middleware/cors';
import { z } from 'zod';

// Validation schemas
const createSessionSchema = z.object({
  program_id: z.string().uuid('Invalid program ID'),
  title: z.string().min(1, 'Title is required').max(255),
  description: z.string().optional(),
  session_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)'),
  start_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, 'Invalid time format (HH:MM)'),
  end_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, 'Invalid time format (HH:MM)'),
  location: z.string().max(255).optional(),
  session_type: z.enum(['lecture', 'lab', 'workshop', 'exam', 'seminar', 'field_trip']).optional(),
});

const bulkCreateSessionsSchema = z.object({
  sessions: z.array(createSessionSchema).min(1, 'At least one session is required'),
});

// OPTIONS /api/sessions
export async function OPTIONS(request: NextRequest) {
  return handleOptionsRequest(request);
}

// GET /api/sessions - Get sessions (with optional program_id filter)
export const GET = withErrorHandler(async (request: NextRequest) => {
  const authResult = await requireAuthAsync(request);
  if ('error' in authResult) return authResult.error;

  const { searchParams } = new URL(request.url);
  const programId = searchParams.get('program_id');
  const upcoming = searchParams.get('upcoming');
  const today = searchParams.get('today');

  if (today === 'true') {
    const sessions = await sessionService.getTodaySessions();
    return successResponse(sessions);
  }

  if (upcoming === 'true') {
    const limit = parseInt(searchParams.get('limit') || '10');
    const sessions = await sessionService.getUpcomingSessions(limit);
    return successResponse(sessions);
  }

  if (programId) {
    const sessions = await sessionService.getSessionsByProgram(programId);
    return successResponse(sessions);
  }

  // Return today's sessions by default if no filter provided
  const sessions = await sessionService.getTodaySessions();
  return successResponse(sessions);
});

// POST /api/sessions - Create new session(s)
export const POST = withErrorHandler(async (request: NextRequest) => {
  const authResult = await requireRoleAsync(request, ['admin', 'staff-trainees']);
  if ('error' in authResult) return authResult.error;

  const body = await request.json();

  // Check if bulk creation
  if (body.sessions && Array.isArray(body.sessions)) {
    const validatedData = bulkCreateSessionsSchema.parse(body);
    const sessions = await sessionService.bulkCreateSessions(validatedData.sessions);

    await activityLogService.logAction(
      authResult.user.userId,
      'bulk_create',
      'session',
      validatedData.sessions[0].program_id,
      { count: sessions.length, program_id: validatedData.sessions[0].program_id }
    );

    return successResponse(sessions, 'Sessions created successfully', 201);
  }

  // Single session creation
  const validatedData = createSessionSchema.parse(body);
  const session = await sessionService.createSession(validatedData);

  await activityLogService.logAction(
    authResult.user.userId,
    'create',
    'session',
    session.id,
    validatedData
  );

  return successResponse(session, 'Session created successfully', 201);
});
