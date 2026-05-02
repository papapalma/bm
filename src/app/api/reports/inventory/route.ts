import { NextRequest } from 'next/server';
import { itemService } from '@/services/itemService';
import { requireAuthAsync } from '@/middleware/auth';
import { successResponse } from '@/utils/responses';
import { withErrorHandler } from '@/middleware/errorHandler';
import { handleOptionsRequest } from '@/middleware/cors';

// OPTIONS /api/reports/inventory - Handle CORS preflight
export async function OPTIONS(request: NextRequest) {
  return handleOptionsRequest(request);
}

// GET /api/reports/inventory - Get inventory report
export const GET = withErrorHandler(async (request: NextRequest) => {
  const authResult = await requireAuthAsync(request);
  if ('error' in authResult) return authResult.error;
  
  const items = await itemService.getAllItems();
  
  const report = {
    totalItems: items.length,
    totalQuantity: items.reduce((sum, item) => sum + item.quantity, 0),
    availableQuantity: items.reduce((sum, item) => sum + item.available_quantity, 0),
    borrowedQuantity: items.reduce(
      (sum, item) => sum + (item.quantity - item.available_quantity),
      0
    ),
    byStatus: items.reduce((acc, item) => {
      acc[item.status] = (acc[item.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>),
    byCategory: items.reduce((acc, item) => {
      acc[item.category] = (acc[item.category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>),
    lowStockItems: items.filter(item => item.status === 'low_stock' || item.status === 'out_of_stock'),
  };
  
  return successResponse(report);
});
