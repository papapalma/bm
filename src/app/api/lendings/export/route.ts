import { NextRequest } from 'next/server';
import { lendingService } from '@/services/lendingService';
import { requireRoleAsync } from '@/middleware/auth';
import { withErrorHandler } from '@/middleware/errorHandler';
import { handleOptionsRequest } from '@/middleware/cors';
import { createCsvDownloadResponse, objectsToCsv } from '@/utils/export';

// OPTIONS /api/lendings/export - Handle CORS preflight
export async function OPTIONS(request: NextRequest) {
  return handleOptionsRequest(request);
}

// GET /api/lendings/export - Export lending records as CSV
export const GET = withErrorHandler(async (request: NextRequest) => {
  const authResult = await requireRoleAsync(request, ['admin', 'staff-inventory', 'staff-trainees']);
  if ('error' in authResult) return authResult.error;

  const { searchParams } = new URL(request.url);
  const trainee_id = searchParams.get('trainee_id') || undefined;
  const status = searchParams.get('status') || undefined;
  const start_date = searchParams.get('start_date') || searchParams.get('startDate') || undefined;
  const end_date = searchParams.get('end_date') || searchParams.get('endDate') || undefined;

  const lendings = await lendingService.getAllLendings({
    trainee_id,
    status,
    start_date,
    end_date,
  });

  const rows = lendings.map((lending) => {
    const traineeName = lending.trainee
      ? `${lending.trainee.first_name} ${lending.trainee.last_name}`
      : lending.borrower_name || '';

    return {
      id: lending.id,
      item_name: lending.item?.name || '',
      borrower: traineeName,
      borrower_contact: lending.borrower_contact || '',
      quantity: lending.quantity,
      status: lending.status,
      lent_date: lending.lent_date,
      expected_return_date: lending.expected_return_date,
      actual_return_date: lending.actual_return_date || '',
      notes: lending.notes || '',
    };
  });

  const csv = objectsToCsv(rows, [
    'id',
    'item_name',
    'borrower',
    'borrower_contact',
    'quantity',
    'status',
    'lent_date',
    'expected_return_date',
    'actual_return_date',
    'notes',
  ]);

  return createCsvDownloadResponse(csv, 'lendings-export.csv');
});
