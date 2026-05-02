import { supabase, supabaseAdmin } from '@/lib/supabase';
import { db } from '@/lib/db';
import { Item } from '@/types';
import { CreateItemInput, UpdateItemInput } from '@/utils/validators';
import { deleteImageWithThumbnail, ensureThumbnailForImagePath } from '@/utils/fileUpload';

export class ItemService {
  private async withThumbnail(item: Item): Promise<Item> {
    return {
      ...item,
      thumbnail_path: await ensureThumbnailForImagePath(item.image_path ?? null),
    };
  }

  async getAllItems(filters?: {
    category?: string;
    status?: string;
    search?: string;
  }): Promise<Item[]> {
    let query = supabase.from('items').select('*');
    
    if (filters?.category) {
      query = query.eq('category', filters.category);
    }
    
    if (filters?.status) {
      query = query.eq('status', filters.status);
    }
    
    if (filters?.search) {
      query = query.or(`name.ilike.%${filters.search}%,description.ilike.%${filters.search}%`);
    }
    
    query = query.order('created_at', { ascending: false });
    
    const { data, error } = await query;
    
    if (error) throw error;

    const items = data || [];
    return Promise.all(items.map((item) => this.withThumbnail(item as Item)));
  }

  async getItemById(id: string): Promise<Item | null> {
    const item = await db.findById<Item>('items', id);
    if (!item) {
      return null;
    }

    return this.withThumbnail(item);
  }

  async createItem(itemData: CreateItemInput, userId: string): Promise<Item> {
    const qrCode = `ITEM-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const newItem = {
      ...itemData,
      qr_code: qrCode,
      available_quantity: itemData.quantity,
      status: this.calculateItemStatus(itemData.quantity, itemData.minimum_quantity || 10),
      created_by: userId,
    };
    
    // Use supabaseAdmin to bypass RLS policies
    const { data, error } = await supabaseAdmin
      .from('items')
      .insert(newItem)
      .select()
      .single();
    
    if (error) throw error;
    return this.withThumbnail(data);
  }

  async updateItem(id: string, itemData: UpdateItemInput): Promise<Item> {
    const existingItem = await this.getItemById(id);
    if (!existingItem) {
      throw new Error('Item not found');
    }
    
    const updateData: any = { ...itemData };
    
    if (itemData.quantity !== undefined) {
      updateData.status = this.calculateItemStatus(
        itemData.quantity,
        itemData.minimum_quantity || existingItem.minimum_quantity
      );
    }

    const imageWasUpdated = Object.prototype.hasOwnProperty.call(itemData, 'image_path');
    const updatedItem = await db.update<Item>('items', id, updateData);

    if (
      imageWasUpdated &&
      existingItem.image_path &&
      itemData.image_path !== existingItem.image_path
    ) {
      await deleteImageWithThumbnail(existingItem.image_path);
    }

    return this.withThumbnail(updatedItem);
  }

  async deleteItem(id: string): Promise<void> {
    const existingItem = await this.getItemById(id);
    await db.delete('items', id);

    if (existingItem?.image_path) {
      await deleteImageWithThumbnail(existingItem.image_path);
    }
  }

  async updateItemQuantity(
    itemId: string,
    quantityChange: number,
    type: 'borrow' | 'return'
  ): Promise<Item> {
    const item = await this.getItemById(itemId);
    if (!item) {
      throw new Error('Item not found');
    }
    
    const newAvailableQuantity = type === 'borrow' 
      ? item.available_quantity - quantityChange
      : item.available_quantity + quantityChange;
    
    if (newAvailableQuantity < 0) {
      throw new Error('Insufficient quantity available');
    }
    
    if (newAvailableQuantity > item.quantity) {
      throw new Error('Return quantity exceeds borrowed quantity');
    }
    
    const status = this.calculateItemStatus(newAvailableQuantity, item.minimum_quantity);
    
    const updatedItem = await db.update<Item>('items', itemId, {
      available_quantity: newAvailableQuantity,
      status,
    });

    return this.withThumbnail(updatedItem);
  }

  private calculateItemStatus(
    quantity: number,
    minimumQuantity: number
  ): 'available' | 'low_stock' | 'out_of_stock' {
    if (quantity === 0) return 'out_of_stock';
    if (quantity <= minimumQuantity) return 'low_stock';
    return 'available';
  }

  async getItemByQRCode(qrCode: string): Promise<Item | null> {
    const { data, error } = await supabase
      .from('items')
      .select('*')
      .eq('qr_code', qrCode)
      .single();
    
    if (error && error.code !== 'PGRST116') throw error;

    if (!data) {
      return null;
    }

    return this.withThumbnail(data as Item);
  }
}

export const itemService = new ItemService();
