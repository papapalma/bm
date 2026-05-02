import { NextRequest } from 'next/server';
import { itemService } from '@/services/itemService';
import { requireAuthAsync, requireRoleAsync } from '@/middleware/auth';
import { createItemSchema } from '@/utils/validators';
import { successResponse, notFoundResponse } from '@/utils/responses';
import { withErrorHandler } from '@/middleware/errorHandler';
import { activityLogService } from '@/services/activityLogService';
import { handleOptionsRequest } from '@/middleware/cors';

// OPTIONS /api/items - Handle CORS preflight
export async function OPTIONS(request: NextRequest) {
  return handleOptionsRequest(request);
}

// GET /api/items - Get all items
export const GET = withErrorHandler(async (request: NextRequest) => {
  const authResult = await requireAuthAsync(request);
  if ('error' in authResult) return authResult.error;
  
  const { searchParams } = new URL(request.url);
  const category = searchParams.get('category') || undefined;
  const status = searchParams.get('status') || undefined;
  const search = searchParams.get('search') || undefined;
  
  const items = await itemService.getAllItems({ category, status, search });
  
  return successResponse(items);
});

// POST /api/items - Create new item
export const POST = withErrorHandler(async (request: NextRequest) => {
  const authResult = await requireRoleAsync(request, ['admin', 'staff-inventory']);
  if ('error' in authResult) return authResult.error;
  
  const body = await request.json();
  const validatedData = createItemSchema.parse(body);
  
  const item = await itemService.createItem(validatedData, authResult.user.userId);
  
  await activityLogService.logAction(
    authResult.user.userId,
    'create',
    'item',
    item.id,
    validatedData
  );
  
  return successResponse(item, 'Item created successfully', 201);
});
