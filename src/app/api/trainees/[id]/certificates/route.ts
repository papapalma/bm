import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireRoleAsync } from '@/middleware/auth';
import { successResponse, notFoundResponse, errorResponse } from '@/utils/responses';
import { withErrorHandler } from '@/middleware/errorHandler';
import { activityLogService } from '@/services/activityLogService';
import { handleOptionsRequest } from '@/middleware/cors';
import { z } from 'zod';

const addCertificateSchema = z.object({
  file_path: z.string().min(1, 'File path is required'),
  title: z.string().min(1, 'Certificate title is required').max(255),
  description: z.string().max(500).optional(),
});

// OPTIONS /api/trainees/:id/certificates - Handle CORS preflight
export async function OPTIONS(request: NextRequest) {
  return handleOptionsRequest(request);
}

/**
 * GET /api/trainees/:id/certificates
 * Get all certificates for a trainee
 * Accessible by admin, staff-trainees, and the trainee themselves
 */
export const GET = withErrorHandler(
  async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const authResult = await requireRoleAsync(request, ['admin', 'staff-trainees', 'trainee']);
    if ('error' in authResult) return authResult.error;

    const { id } = await params;

    // If trainee role, verify they're accessing their own profile
    if (authResult.user.role === 'trainee') {
      const { data: traineeAccount } = await supabaseAdmin
        .from('trainee_accounts')
        .select('trainee_id')
        .eq('user_id', authResult.user.userId)
        .single();

      if (!traineeAccount || traineeAccount.trainee_id !== id) {
        return errorResponse('You can only access your own certificates', 403);
      }
    }

    // Get trainee with certificates
    const { data: trainee, error } = await supabaseAdmin
      .from('trainees')
      .select('id, first_name, last_name, certificates')
      .eq('id', id)
      .single();

    if (error || !trainee) {
      return notFoundResponse('Trainee not found');
    }

    const certificates = trainee.certificates || [];

    return successResponse({
      trainee_id: trainee.id,
      trainee_name: `${trainee.first_name} ${trainee.last_name}`,
      certificates,
    });
  }
);

/**
 * POST /api/trainees/:id/certificates
 * Upload a certificate for a trainee (admin and staff-trainees only)
 */
export const POST = withErrorHandler(
  async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const authResult = await requireRoleAsync(request, ['admin', 'staff-trainees']);
    if ('error' in authResult) return authResult.error;

    const { id } = await params;
    const body = await request.json();

    // Validate input
    const validatedData = addCertificateSchema.parse(body);

    // Check if trainee exists
    const { data: trainee, error: traineeError } = await supabaseAdmin
      .from('trainees')
      .select('id, first_name, last_name, certificates')
      .eq('id', id)
      .single();

    if (traineeError || !trainee) {
      return notFoundResponse('Trainee not found');
    }

    // Create new certificate object
    const newCertificate = {
      id: crypto.randomUUID(),
      file_path: validatedData.file_path,
      title: validatedData.title,
      description: validatedData.description || null,
      uploaded_at: new Date().toISOString(),
      uploaded_by: authResult.user.userId,
    };

    // Get existing certificates
    const existingCertificates = Array.isArray(trainee.certificates) ? trainee.certificates : [];

    // Add new certificate to the array
    const updatedCertificates = [...existingCertificates, newCertificate];

    // Update trainee record
    const { data: updatedTrainee, error: updateError } = await supabaseAdmin
      .from('trainees')
      .update({ certificates: updatedCertificates })
      .eq('id', id)
      .select('certificates')
      .single();

    if (updateError) {
      throw updateError;
    }

    // Log activity
    await activityLogService.logAction(
      authResult.user.userId,
      'create',
      'certificate',
      id,
      {
        certificate_id: newCertificate.id,
        title: validatedData.title,
        trainee_name: `${trainee.first_name} ${trainee.last_name}`,
      }
    );

    return successResponse(
      {
        certificate: newCertificate,
        total_certificates: updatedTrainee.certificates.length,
      },
      'Certificate uploaded successfully'
    );
  }
);

/**
 * DELETE /api/trainees/:id/certificates/:certificateId
 * Delete a certificate (admin and staff-trainees only)
 */
export const DELETE = withErrorHandler(
  async (
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
  ) => {
    const authResult = await requireRoleAsync(request, ['admin', 'staff-trainees']);
    if ('error' in authResult) return authResult.error;

    const { id } = await params;
    
    // Get certificate ID from URL search params
    const { searchParams } = new URL(request.url);
    const certificateId = searchParams.get('certificateId');

    if (!certificateId) {
      return errorResponse('Certificate ID is required', 400);
    }

    // Get trainee with certificates
    const { data: trainee, error: traineeError } = await supabaseAdmin
      .from('trainees')
      .select('id, first_name, last_name, certificates')
      .eq('id', id)
      .single();

    if (traineeError || !trainee) {
      return notFoundResponse('Trainee not found');
    }

    const existingCertificates = Array.isArray(trainee.certificates) ? trainee.certificates : [];

    // Find and remove the certificate
    const certificateToDelete = existingCertificates.find((cert: any) => cert.id === certificateId);
    
    if (!certificateToDelete) {
      return notFoundResponse('Certificate not found');
    }

    const updatedCertificates = existingCertificates.filter((cert: any) => cert.id !== certificateId);

    // Update trainee record
    const { error: updateError } = await supabaseAdmin
      .from('trainees')
      .update({ certificates: updatedCertificates })
      .eq('id', id);

    if (updateError) {
      throw updateError;
    }

    // Log activity
    await activityLogService.logAction(
      authResult.user.userId,
      'delete',
      'certificate',
      id,
      {
        certificate_id: certificateId,
        title: certificateToDelete.title,
        trainee_name: `${trainee.first_name} ${trainee.last_name}`,
      }
    );

    return successResponse(
      { deleted_certificate_id: certificateId },
      'Certificate deleted successfully'
    );
  }
);
