import { supabase, supabaseAdmin } from '@/lib/supabase';
import { Lending } from '@/types';
import { CreateLendingInput, ReturnLendingInput } from '@/utils/validators';
import { itemService } from './itemService';

export class LendingService {
  async getAllLendings(filters?: {
    trainee_id?: string;
    status?: string;
    start_date?: string;
    end_date?: string;
  }): Promise<Lending[]> {
    let query = supabase.from('lendings').select(`
      *,
      item:items(*),
      trainee:trainees(*)
    `);
    
    if (filters?.trainee_id) {
      query = query.eq('trainee_id', filters.trainee_id);
    }
    
    if (filters?.status) {
      query = query.eq('status', filters.status);
    }
    
    if (filters?.start_date) {
      query = query.gte('lent_date', filters.start_date);
    }
    
    if (filters?.end_date) {
      query = query.lte('lent_date', filters.end_date);
    }
    
    query = query.order('lent_date', { ascending: false });
    
    const { data, error } = await query;
    
    if (error) throw error;
    return data || [];
  }

  async getLendingById(id: string): Promise<Lending | null> {
    const { data, error } = await supabase
      .from('lendings')
      .select(`
        *,
        item:items(*),
        trainee:trainees(*)
      `)
      .eq('id', id)
      .single();
    
    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      throw error;
    }
    return data;
  }

  async createLending(lendingData: CreateLendingInput, userId: string): Promise<Lending> {
    // Validate item availability
    const itemDetails = await itemService.getItemById(lendingData.item_id);
    if (!itemDetails) {
      throw new Error(`Item ${lendingData.item_id} not found`);
    }
    if (itemDetails.available_quantity === 0) {
      throw new Error(`Item "${itemDetails.name}" is out of stock`);
    }
    if (itemDetails.available_quantity < lendingData.quantity) {
      throw new Error(
        `Insufficient quantity for "${itemDetails.name}". Requested: ${lendingData.quantity}, available: ${itemDetails.available_quantity}`
      );
    }
    
    // Create lending record
    const newLending: Record<string, unknown> = {
      item_id: lendingData.item_id,
      quantity: lendingData.quantity,
      expected_return_date: lendingData.expected_return_date,
      notes: lendingData.notes,
      status: 'active',
      lent_date: new Date().toISOString(),
      lent_by: userId,
    };

    if (lendingData.trainee_id) {
      newLending.trainee_id = lendingData.trainee_id;
    }
    if (lendingData.borrower_name) {
      newLending.borrower_name = lendingData.borrower_name;
    }
    if (lendingData.borrower_contact) {
      newLending.borrower_contact = lendingData.borrower_contact;
    }
    
    // Use supabaseAdmin to bypass RLS policies
    const { data: lending, error } = await supabaseAdmin
      .from('lendings')
      .insert(newLending)
      .select(`
        *,
        item:items(*),
        trainee:trainees(*)
      `)
      .single();
    
    if (error) throw error;
    
    // Update item quantity
    await itemService.updateItemQuantity(lendingData.item_id, lendingData.quantity, 'borrow');
    
    return lending;
  }

  async returnLending(
    id: string,
    returnData: ReturnLendingInput,
    userId: string
  ): Promise<Lending> {
    const lending = await this.getLendingById(id);
    if (!lending) {
      throw new Error('Lending not found');
    }
    
    if (lending.status === 'returned') {
      throw new Error('Lending already returned');
    }
    
    // Mark as returned and update item quantity
    await itemService.updateItemQuantity(lending.item_id, lending.quantity, 'return');
    
    // Update lending
    const { data: updatedLending, error } = await supabaseAdmin
      .from('lendings')
      .update({
        status: 'returned',
        actual_return_date: new Date().toISOString(),
        returned_by: userId,
        notes: returnData.notes 
          ? `${lending.notes || ''}\n${returnData.notes}`.trim() 
          : lending.notes,
      })
      .eq('id', id)
      .select(`
        *,
        item:items(*),
        trainee:trainees(*)
      `)
      .single();
    
    if (error) throw error;
    return updatedLending;
  }

  async markOverdue(): Promise<number> {
    const today = new Date().toISOString().split('T')[0];
    const { data: lendings, error } = await supabase
      .from('lendings')
      .select('*')
      .eq('status', 'active')
      .lt('expected_return_date', today);
    
    if (error) throw error;
    
    let count = 0;
    for (const lending of lendings || []) {
      await supabaseAdmin
        .from('lendings')
        .update({ status: 'overdue' })
        .eq('id', lending.id);
      count++;
    }
    
    return count;
  }

  async getLendingsByTrainee(traineeId: string): Promise<Lending[]> {
    return this.getAllLendings({ trainee_id: traineeId });
  }

  async getActiveLendings(): Promise<Lending[]> {
    return this.getAllLendings({ status: 'active' });
  }

  async getOverdueLendings(): Promise<Lending[]> {
    const { data, error } = await supabase
      .from('lendings')
      .select(`
        *,
        item:items(*),
        trainee:trainees(*)
      `)
      .eq('status', 'overdue')
      .order('expected_return_date', { ascending: true });
    
    if (error) throw error;
    return data || [];
  }
}

export const lendingService = new LendingService();
