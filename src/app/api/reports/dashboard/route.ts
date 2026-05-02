import { NextRequest } from 'next/server';
import { requireAuthAsync } from '@/middleware/auth';
import { successResponse } from '@/utils/responses';
import { withErrorHandler } from '@/middleware/errorHandler';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { handleOptionsRequest } from '@/middleware/cors';

// OPTIONS /api/reports/dashboard - Handle CORS preflight
export async function OPTIONS(request: NextRequest) {
  return handleOptionsRequest(request);
}

// GET /api/reports/dashboard - Get dashboard statistics
export const GET = withErrorHandler(async (request: NextRequest) => {
  const authResult = await requireAuthAsync(request);
  if ('error' in authResult) return authResult.error;
  
  // Fetch all required data in parallel
  const [
    traineesResult,
    itemsResult,
    lendingsResult,
    programsResult
  ] = await Promise.all([
    supabaseAdmin.from('trainees').select('status'),
    supabaseAdmin.from('items').select('quantity, available_quantity, status'),
    supabaseAdmin.from('lendings').select('status, expected_return_date, actual_return_date'),
    supabaseAdmin.from('programs').select('status')
  ]);

  // Calculate trainee statistics
  const trainees = traineesResult.data || [];
  const traineeStats = {
    total: trainees.length,
    active: trainees.filter(t => t.status === 'active').length,
    completed: trainees.filter(t => t.status === 'completed').length,
    inactive: trainees.filter(t => t.status === 'inactive').length,
  };

  // Calculate inventory statistics
  const items = itemsResult.data || [];
  const inventoryStats = {
    total: items.length,
    available: items.reduce((sum, item) => sum + item.available_quantity, 0),
    borrowed: items.reduce((sum, item) => sum + (item.quantity - item.available_quantity), 0),
    lowStock: items.filter(item => item.status === 'low_stock' || item.status === 'out_of_stock').length,
  };

  // Calculate lending statistics
  const lendings = lendingsResult.data || [];
  const now = new Date();
  const lendingStats = {
    total: lendings.length,
    active: lendings.filter(l => l.status === 'active').length,
    overdue: lendings.filter(l => {
      if (l.status !== 'active') return false;
    return l.expected_return_date && new Date(l.expected_return_date) < now;
    }).length,
    returned: lendings.filter(l => l.status === 'returned').length,
  };

  // Calculate program statistics
  const programs = programsResult.data || [];
  const programStats = {
    total: programs.length,
    ongoing: programs.filter(p => p.status === 'active').length,
    upcoming: programs.filter(p => p.status === 'upcoming').length,
    completed: programs.filter(p => p.status === 'completed').length,
  };

  const dashboardStats = {
    trainees: traineeStats,
    inventory: inventoryStats,
    lending: lendingStats,
    programs: programStats,
  };

  return successResponse(dashboardStats);
});
