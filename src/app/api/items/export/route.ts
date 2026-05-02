import { NextRequest } from 'next/server';
import { itemService } from '@/services/itemService';
import { requireRoleAsync } from '@/middleware/auth';
import { withErrorHandler } from '@/middleware/errorHandler';
import { handleOptionsRequest } from '@/middleware/cors';
import { createCsvDownloadResponse, objectsToCsv } from '@/utils/export';

// OPTIONS /api/items/export - Handle CORS preflight
export async function OPTIONS(request: NextRequest) {
  return handleOptionsRequest(request);
}

// GET /api/items/export - Export items as CSV
export const GET = withErrorHandler(async (request: NextRequest) => {
  const authResult = await requireRoleAsync(request, ['admin', 'staff-inventory', 'staff-trainees']);
  if ('error' in authResult) return authResult.error;

  const { searchParams } = new URL(request.url);
  const category = searchParams.get('category') || undefined;
  const status = searchParams.get('status') || undefined;
  const search = searchParams.get('search') || undefined;

  const items = await itemService.getAllItems({ category, status, search });

  const rows = items.map((item) => ({
    id: item.id,
    name: item.name,
    category: item.category,
    status: item.status,
    quantity: item.quantity,
    available_quantity: item.available_quantity,
    minimum_quantity: item.minimum_quantity,
    unit: item.unit,
    location: item.location,
    condition: item.condition || '',
    purchase_date: item.purchase_date || '',
    created_at: item.created_at,
  }));

  const csv = objectsToCsv(rows, [
    'id',
    'name',
    'category',
    'status',
    'quantity',
    'available_quantity',
    'minimum_quantity',
    'unit',
    'location',
    'condition',
    'purchase_date',
    'created_at',
  ]);

  return createCsvDownloadResponse(csv, 'items-export.csv');
});
