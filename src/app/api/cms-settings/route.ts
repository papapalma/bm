import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { withErrorHandler } from '@/middleware/errorHandler';
import { requireAuthAsync } from '@/middleware/auth';
import { handleOptionsRequest } from '@/middleware/cors';

export async function OPTIONS(request: NextRequest) {
  return handleOptionsRequest(request);
}

/**
 * GET /api/cms-settings
 * Get all CMS settings
 * Public endpoint - no auth required for reading
 */
export const GET = withErrorHandler(async (request: NextRequest) => {
  const { data, error } = await supabase
    .from('cms_settings')
    .select('*');

  if (error) throw error;

  // Convert array of key-value pairs to nested object structure
  const settings: Record<string, any> = {};
  
  data?.forEach(item => {
    try {
      // Try to parse as JSON first
      settings[item.key] = JSON.parse(item.value);
    } catch {
      // If not JSON, store as string
      settings[item.key] = item.value;
    }
  });

  return NextResponse.json({
    success: true,
    data: settings
  });
});

/**
 * PUT /api/cms-settings
 * Update a single CMS setting (upsert)
 * Requires authentication
 * 
 * Body: { key: string, value: any, description?: string }
 */
export const PUT = withErrorHandler(async (request: NextRequest) => {
  const authResult = await requireAuthAsync(request);
  if ('error' in authResult) return authResult.error;

  const body = await request.json();
  const { key, value, description } = body;

  if (!key) throw new Error('Key is required');
  if (value === undefined) throw new Error('Value is required');

  // Convert value to string (JSON if object, string if primitive)
  const valueStr = typeof value === 'string' ? value : JSON.stringify(value);

  const { data, error } = await supabase
    .from('cms_settings')
    .upsert({
      key,
      value: valueStr,
      description: description || null,
      updated_at: new Date().toISOString()
    }, {
      onConflict: 'key'
    })
    .select()
    .single();

  if (error) throw error;

  return NextResponse.json({
    success: true,
    data
  });
});


