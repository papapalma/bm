import { NextRequest } from 'next/server';
import { itemService } from '@/services/itemService';
import { requireRoleAsync } from '@/middleware/auth';
import { updateItemSchema } from '@/utils/validators';
import { successResponse, notFoundResponse, noContentResponse } from '@/utils/responses';
import { withErrorHandler } from '@/middleware/errorHandler';
import { activityLogService } from '@/services/activityLogService';
import { handleOptionsRequest } from '@/middleware/cors';

// OPTIONS /api/items/:id - Handle CORS preflight
export async function OPTIONS(request: NextRequest) {
  return handleOptionsRequest(request);
}

// GET /api/items/:id - Get item by ID
export const GET = withErrorHandler(
  async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const authResult = await requireRoleAsync(request, ['admin', 'staff-inventory', 'staff-trainees']);
    if ('error' in authResult) return authResult.error;

    const { id } = await params;
    const item = await itemService.getItemById(id);
    
    if (!item) {
      return notFoundResponse('Item not found');
    }
    
    return successResponse(item);
  }
);

// PUT /api/items/:id - Update item
export const PUT = withErrorHandler(
  async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;
    const authResult = await requireRoleAsync(request, ['admin', 'staff-inventory']);
    if ('error' in authResult) return authResult.error;
    
    const body = await request.json();
    
    try {
      const validatedData = updateItemSchema.parse(body);
      
      const item = await itemService.updateItem(id, validatedData);
      
      await activityLogService.logAction(
        authResult.user.userId,
        'update',
        'item',
        id,
        validatedData
      );
      
      return successResponse(item, 'Item updated successfully');
    } catch (validationError: any) {
      throw validationError;
    }
  }
);

// DELETE /api/items/:id - Delete item
export const DELETE = withErrorHandler(
  async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;
    const authResult = await requireRoleAsync(request, ['admin']);
    if ('error' in authResult) return authResult.error;
    
    await itemService.deleteItem(id);
    
    await activityLogService.logAction(
      authResult.user.userId,
      'delete',
      'item',
      id
    );
    
    return noContentResponse();
  }
);
