import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { withErrorHandler } from '@/middleware/errorHandler';
import { requireAuthAsync } from '@/middleware/auth';
import { handleOptionsRequest } from '@/middleware/cors';

/**
 * OPTIONS /api/cms-settings/bulk - Handle CORS preflight
 */
export async function OPTIONS(request: NextRequest) {
  return handleOptionsRequest(request);
}

/**
 * POST /api/cms-settings/bulk
 * Bulk update multiple settings
 * Requires authentication
 * 
 * Body: { settings: Record<string, any> }
 */
export const POST = withErrorHandler(async (request: NextRequest) => {
  const authResult = await requireAuthAsync(request);
  if ('error' in authResult) return authResult.error;

  const body = await request.json();
  const { settings } = body;

  if (!settings || typeof settings !== 'object') {
    throw new Error('Settings object is required');
  }

  // Convert settings object to array of upsert operations
  const upsertData = Object.entries(settings).map(([key, value]) => ({
    key,
    value: typeof value === 'string' ? value : JSON.stringify(value),
    updated_at: new Date().toISOString()
  }));

  const { data, error } = await supabase
    .from('cms_settings')
    .upsert(upsertData, {
      onConflict: 'key'
    })
    .select();

  if (error) throw error;

  return NextResponse.json({
    success: true,
    data,
    message: `Updated ${data?.length || 0} settings`
  });
});
