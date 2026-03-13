import { createClient } from '@supabase/supabase-js';

// Supabase configuration
const supabaseUrl = process.env.REACT_APP_SUPABASE_URL || '';
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_KEY || '';

// Create Supabase client
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// ============================================================================
// DATABASE TYPES (TypeScript Interfaces)
// ============================================================================

export interface InventoryItem {
  id: string;
  name: string;
  category: string;
  subcategory?: string;
  unit_of_measurement: string;
  current_stock: number;
  minimum_stock_level: number;
  maximum_stock_level?: number;
  price_per_unit?: number;
  location?: string;
  description?: string;
  barcode?: string;
  created_at: string;
  updated_at: string;
}

export interface Request {
  id: string;
  request_number: string;
  requester_name: string;
  requester_email: string;
  requester_type: 'student' | 'faculty';
  student_id?: string;
  department: string;
  course?: string;
  year_level?: string;
  request_date: string;
  purpose: string;
  notes?: string;
  status: 'pending' | 'approved' | 'rejected' | 'completed';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  reviewed_by?: string;
  reviewed_at?: string;
  admin_notes?: string;
  rejection_reason?: string;
  created_at: string;
  updated_at: string;
}

export interface RequestItem {
  id: string;
  request_id: string;
  item_name: string;
  category: string;
  quantity: number;
  unit: string;
  quantity_fulfilled: number;
  fulfillment_status: 'pending' | 'partial' | 'fulfilled' | 'unavailable';
  inventory_item_id?: string;
  created_at: string;
}

export interface StockMovement {
  id: string;
  inventory_item_id: string;
  movement_type: 'IN' | 'OUT' | 'ADJUSTMENT';
  quantity: number;
  previous_stock: number;
  new_stock: number;
  reference_type?: string;
  reference_id?: string;
  performed_by: string;
  reason?: string;
  notes?: string;
  movement_date: string;
}

export interface Category {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  color?: string;
  subcategories?: string[];
  is_active: boolean;
  created_at: string;
}

export interface Notification {
  id: string;
  type: 'low_stock' | 'critical_stock' | 'new_request' | 'request_update';
  title: string;
  message: string;
  severity: 'info' | 'warning' | 'critical';
  related_item_id?: string;
  related_type?: string;
  is_read: boolean;
  read_at?: string;
  read_by?: string;
  created_at: string;
}

// ============================================================================
// DATABASE OPERATIONS
// ============================================================================

// ----------------------------------------------------------------------------
// INVENTORY OPERATIONS
// ----------------------------------------------------------------------------

export const inventoryAPI = {
  // Get all inventory items
  async getAll() {
    const { data, error } = await supabase
      .from('inventory')
      .select('*')
      .order('name');
    
    if (error) throw error;
    return data as InventoryItem[];
  },

  // Get single item by ID
  async getById(id: string) {
    const { data, error } = await supabase
      .from('inventory')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) throw error;
    return data as InventoryItem;
  },

  // Get low stock items
  async getLowStock() {
    const { data, error } = await supabase
      .from('inventory')
      .select('*')
      .lt('current_stock', supabase.raw('minimum_stock_level'))
      .order('current_stock');
    
    if (error) throw error;
    return data as InventoryItem[];
  },

  // Search inventory
  async search(query: string) {
    const { data, error } = await supabase
      .from('inventory')
      .select('*')
      .or(`name.ilike.%${query}%,description.ilike.%${query}%,category.ilike.%${query}%`)
      .order('name');
    
    if (error) throw error;
    return data as InventoryItem[];
  },

  // Filter by category
  async getByCategory(category: string) {
    const { data, error } = await supabase
      .from('inventory')
      .select('*')
      .eq('category', category)
      .order('name');
    
    if (error) throw error;
    return data as InventoryItem[];
  },

  // Add new item
  async create(item: Partial<InventoryItem>) {
    const { data, error } = await supabase
      .from('inventory')
      .insert(item)
      .select()
      .single();
    
    if (error) throw error;
    return data as InventoryItem;
  },

  // Update item
  async update(id: string, updates: Partial<InventoryItem>) {
    const { data, error } = await supabase
      .from('inventory')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data as InventoryItem;
  },

  // Delete item
  async delete(id: string) {
    const { error } = await supabase
      .from('inventory')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
  }
};

// ----------------------------------------------------------------------------
// REQUEST OPERATIONS
// ----------------------------------------------------------------------------

export const requestsAPI = {
  // Get all requests
  async getAll() {
    const { data, error } = await supabase
      .from('requests')
      .select(`
        *,
        request_items (*)
      `)
      .order('request_date', { ascending: false });
    
    if (error) throw error;
    return data;
  },

  // Get requests by status
  async getByStatus(status: string) {
    const { data, error } = await supabase
      .from('requests')
      .select(`
        *,
        request_items (*)
      `)
      .eq('status', status)
      .order('request_date', { ascending: false });
    
    if (error) throw error;
    return data;
  },

  // Get single request with items
  async getById(id: string) {
    const { data, error } = await supabase
      .from('requests')
      .select(`
        *,
        request_items (*)
      `)
      .eq('id', id)
      .single();
    
    if (error) throw error;
    return data;
  },

  // Create new request
  async create(request: Partial<Request>, items: Partial<RequestItem>[]) {
    // Insert request
    const { data: requestData, error: requestError } = await supabase
      .from('requests')
      .insert(request)
      .select()
      .single();
    
    if (requestError) throw requestError;

    // Insert request items
    const itemsWithRequestId = items.map(item => ({
      ...item,
      request_id: requestData.id
    }));

    const { data: itemsData, error: itemsError } = await supabase
      .from('request_items')
      .insert(itemsWithRequestId)
      .select();
    
    if (itemsError) throw itemsError;

    return { request: requestData, items: itemsData };
  },

  // Update request status
  async updateStatus(
    id: string, 
    status: string, 
    reviewedBy: string, 
    adminNotes?: string,
    rejectionReason?: string
  ) {
    const { data, error } = await supabase
      .from('requests')
      .update({
        status,
        reviewed_by: reviewedBy,
        reviewed_at: new Date().toISOString(),
        admin_notes: adminNotes,
        rejection_reason: rejectionReason,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  // Search requests
  async search(query: string) {
    const { data, error } = await supabase
      .from('requests')
      .select(`
        *,
        request_items (*)
      `)
      .or(`requester_name.ilike.%${query}%,requester_email.ilike.%${query}%,request_number.ilike.%${query}%,department.ilike.%${query}%`)
      .order('request_date', { ascending: false });
    
    if (error) throw error;
    return data;
  }
};

// ----------------------------------------------------------------------------
// STOCK MOVEMENT OPERATIONS
// ----------------------------------------------------------------------------

export const stockMovementsAPI = {
  // Record stock movement
  async create(movement: Partial<StockMovement>) {
    const { data, error } = await supabase
      .from('stock_movements')
      .insert(movement)
      .select()
      .single();
    
    if (error) throw error;
    return data as StockMovement;
  },

  // Get movements for an item
  async getByItem(inventoryItemId: string) {
    const { data, error } = await supabase
      .from('stock_movements')
      .select('*')
      .eq('inventory_item_id', inventoryItemId)
      .order('movement_date', { ascending: false });
    
    if (error) throw error;
    return data as StockMovement[];
  },

  // Get recent movements
  async getRecent(limit = 50) {
    const { data, error } = await supabase
      .from('stock_movements')
      .select(`
        *,
        inventory (name, category)
      `)
      .order('movement_date', { ascending: false })
      .limit(limit);
    
    if (error) throw error;
    return data;
  }
};

// ----------------------------------------------------------------------------
// CATEGORY OPERATIONS
// ----------------------------------------------------------------------------

export const categoriesAPI = {
  // Get all active categories
  async getAll() {
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .eq('is_active', true)
      .order('name');
    
    if (error) throw error;
    return data as Category[];
  },

  // Create category
  async create(category: Partial<Category>) {
    const { data, error } = await supabase
      .from('categories')
      .insert(category)
      .select()
      .single();
    
    if (error) throw error;
    return data as Category;
  }
};

// ----------------------------------------------------------------------------
// NOTIFICATION OPERATIONS
// ----------------------------------------------------------------------------

export const notificationsAPI = {
  // Get unread notifications
  async getUnread() {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('is_read', false)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data as Notification[];
  },

  // Mark as read
  async markAsRead(id: string, readBy: string) {
    const { data, error } = await supabase
      .from('notifications')
      .update({
        is_read: true,
        read_at: new Date().toISOString(),
        read_by: readBy
      })
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  // Get all notifications
  async getAll(limit = 100) {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);
    
    if (error) throw error;
    return data as Notification[];
  }
};

// ----------------------------------------------------------------------------
// ANALYTICS & REPORTS
// ----------------------------------------------------------------------------

export const analyticsAPI = {
  // Get request statistics
  async getRequestStats(days = 30) {
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - days);

    const { data, error } = await supabase
      .from('requests')
      .select('status, department, created_at')
      .gte('created_at', fromDate.toISOString());
    
    if (error) throw error;
    return data;
  },

  // Get top requested items
  async getTopRequestedItems(limit = 10) {
    const { data, error } = await supabase
      .from('request_items')
      .select('item_name, category, quantity')
      .order('created_at', { ascending: false })
      .limit(1000); // Get recent items to analyze
    
    if (error) throw error;
    
    // Aggregate in JavaScript (or use database functions)
    const aggregated = data.reduce((acc: any, item) => {
      const key = item.item_name;
      if (!acc[key]) {
        acc[key] = {
          name: item.item_name,
          category: item.category,
          requests: 0,
          totalQuantity: 0
        };
      }
      acc[key].requests++;
      acc[key].totalQuantity += item.quantity;
      return acc;
    }, {});

    return Object.values(aggregated)
      .sort((a: any, b: any) => b.requests - a.requests)
      .slice(0, limit);
  },

  // Get stock value
  async getTotalStockValue() {
    const { data, error } = await supabase
      .from('inventory')
      .select('current_stock, price_per_unit');
    
    if (error) throw error;
    
    const totalValue = data.reduce((sum, item) => {
      return sum + (item.current_stock * (item.price_per_unit || 0));
    }, 0);

    return totalValue;
  }
};

// ============================================================================
// REAL-TIME SUBSCRIPTIONS
// ============================================================================

export const subscriptions = {
  // Subscribe to new requests
  subscribeToNewRequests(callback: (payload: any) => void) {
    return supabase
      .channel('new-requests')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'requests'
      }, callback)
      .subscribe();
  },

  // Subscribe to inventory changes
  subscribeToInventoryChanges(callback: (payload: any) => void) {
    return supabase
      .channel('inventory-changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'inventory'
      }, callback)
      .subscribe();
  },

  // Subscribe to notifications
  subscribeToNotifications(callback: (payload: any) => void) {
    return supabase
      .channel('notifications')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications'
      }, callback)
      .subscribe();
  }
};
