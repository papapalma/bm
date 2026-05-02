import { NextRequest, NextResponse } from 'next/server';
import { requireRoleAsync } from '@/middleware/auth';
import { supabaseAdmin } from '@/lib/supabase-admin';
import logger from '@/utils/logger';

/**
 * PUT /api/programs/:id/instructors
 * Update instructor assignments for a program
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireRoleAsync(request, ['admin', 'staff-trainees']);
    if ('error' in authResult) {
      return authResult.error;
    }

    const { id: programId } = await params;
    const body = await request.json();
    const { instructorIds }: { instructorIds: string[] } = body;

    if (!Array.isArray(instructorIds)) {
      return NextResponse.json(
        { success: false, message: 'instructorIds must be an array' },
        { status: 400 }
      );
    }

    // Verify program exists
    const { data: program, error: programError } = await supabaseAdmin
      .from('programs')
      .select('id, name')
      .eq('id', programId)
      .single();

    if (programError || !program) {
      return NextResponse.json(
        { success: false, message: 'Program not found' },
        { status: 404 }
      );
    }

    // Delete existing assignments
    const { error: deleteError } = await supabaseAdmin
      .from('program_instructors')
      .delete()
      .eq('program_id', programId);

    if (deleteError) {
      logger.error('Error deleting program instructors:', deleteError);
      return NextResponse.json(
        { success: false, message: 'Failed to update instructor assignments' },
        { status: 500 }
      );
    }

    // Insert new assignments (if any)
    if (instructorIds.length > 0) {
      const assignments = instructorIds.map(instructorId => ({
        program_id: programId,
        instructor_id: instructorId,
        role: 'instructor',
      }));

      const { error: insertError } = await supabaseAdmin
        .from('program_instructors')
        .insert(assignments);

      if (insertError) {
        logger.error('Error inserting program instructors:', insertError);
        return NextResponse.json(
          { success: false, message: 'Failed to assign instructors' },
          { status: 500 }
        );
      }
    }

    logger.info(`Program instructors updated for program ${programId} by ${authResult.user.email}`);

    return NextResponse.json({
      success: true,
      message: 'Instructor assignments updated successfully',
    });

  } catch (error) {
    logger.error('Error in PUT /api/programs/:id/instructors:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}
