// Mock data for development (UI-only version)
// This file simulates database responses without requiring a backend connection

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
  request_items?: RequestItem[];
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
// MOCK DATA STORAGE
// ============================================================================

let mockInventory: InventoryItem[] = [
  {
    id: '1',
    name: 'Laptop - Dell XPS 15',
    category: 'Electronics',
    subcategory: 'Computers',
    unit_of_measurement: 'units',
    current_stock: 45,
    minimum_stock_level: 20,
    maximum_stock_level: 100,
    price_per_unit: 1299.99,
    location: 'Storage Room A, Shelf 3',
    description: 'High-performance laptop for faculty and students',
    barcode: 'DELL-XPS15-001',
    created_at: '2024-01-15T08:00:00Z',
    updated_at: '2024-03-10T14:30:00Z',
  },
  {
    id: '2',
    name: 'Whiteboard Markers - Black',
    category: 'Office Supplies',
    subcategory: 'Writing Instruments',
    unit_of_measurement: 'boxes',
    current_stock: 8,
    minimum_stock_level: 15,
    maximum_stock_level: 50,
    price_per_unit: 12.99,
    location: 'Supply Closet B, Bin 12',
    description: 'Dry-erase markers for classroom use',
    barcode: 'MARK-BLK-BOX24',
    created_at: '2024-02-01T09:00:00Z',
    updated_at: '2024-03-12T11:15:00Z',
  },
  {
    id: '3',
    name: 'Projector - Epson PowerLite',
    category: 'Electronics',
    subcategory: 'AV Equipment',
    unit_of_measurement: 'units',
    current_stock: 5,
    minimum_stock_level: 10,
    maximum_stock_level: 25,
    price_per_unit: 899.00,
    location: 'AV Equipment Room',
    description: 'HD projector for presentations',
    barcode: 'EPSON-PL-500',
    created_at: '2024-01-20T10:00:00Z',
    updated_at: '2024-03-11T16:45:00Z',
  },
  {
    id: '4',
    name: 'Paper - A4 Ream',
    category: 'Office Supplies',
    subcategory: 'Paper Products',
    unit_of_measurement: 'reams',
    current_stock: 120,
    minimum_stock_level: 50,
    maximum_stock_level: 200,
    price_per_unit: 4.99,
    location: 'Storage Room B, Pallet 5',
    description: 'Standard white A4 paper, 500 sheets per ream',
    barcode: 'PAPER-A4-500',
    created_at: '2024-01-10T08:00:00Z',
    updated_at: '2024-03-13T09:20:00Z',
  },
  {
    id: '5',
    name: 'Chemistry Lab Beakers - 500ml',
    category: 'Laboratory',
    subcategory: 'Glassware',
    unit_of_measurement: 'units',
    current_stock: 3,
    minimum_stock_level: 20,
    maximum_stock_level: 50,
    price_per_unit: 8.50,
    location: 'Lab Storage, Cabinet C3',
    description: 'Borosilicate glass beakers for chemistry experiments',
    barcode: 'BEAKER-500ML',
    created_at: '2024-02-05T10:30:00Z',
    updated_at: '2024-03-12T13:00:00Z',
  },
];

let mockRequests: Request[] = [
  {
    id: 'req-001',
    request_number: 'REQ-2024-001',
    requester_name: 'Maria Santos',
    requester_email: 'maria.santos@university.edu',
    requester_type: 'faculty',
    department: 'Computer Science',
    request_date: '2024-03-13T08:30:00Z',
    purpose: 'Classroom presentation for CS101 course',
    notes: 'Needed for tomorrow morning class',
    status: 'pending',
    priority: 'high',
    created_at: '2024-03-13T08:30:00Z',
    updated_at: '2024-03-13T08:30:00Z',
    request_items: [
      {
        id: 'item-001',
        request_id: 'req-001',
        item_name: 'Projector - Epson PowerLite',
        category: 'Electronics',
        quantity: 2,
        unit: 'units',
        quantity_fulfilled: 0,
        fulfillment_status: 'pending',
        inventory_item_id: '3',
        created_at: '2024-03-13T08:30:00Z',
      },
    ],
  },
  {
    id: 'req-002',
    request_number: 'REQ-2024-002',
    requester_name: 'John dela Cruz',
    requester_email: 'john.delacruz@university.edu',
    requester_type: 'student',
    student_id: '2021-12345',
    department: 'Chemistry',
    course: 'BS Chemistry',
    year_level: '3rd Year',
    request_date: '2024-03-12T14:15:00Z',
    purpose: 'Laboratory experiment for Organic Chemistry course',
    notes: 'Part of thesis research',
    status: 'approved',
    priority: 'normal',
    reviewed_by: 'Admin User',
    reviewed_at: '2024-03-12T15:00:00Z',
    admin_notes: 'Approved for laboratory use',
    created_at: '2024-03-12T14:15:00Z',
    updated_at: '2024-03-12T15:00:00Z',
    request_items: [
      {
        id: 'item-002',
        request_id: 'req-002',
        item_name: 'Chemistry Lab Beakers - 500ml',
        category: 'Laboratory',
        quantity: 10,
        unit: 'units',
        quantity_fulfilled: 10,
        fulfillment_status: 'fulfilled',
        inventory_item_id: '5',
        created_at: '2024-03-12T14:15:00Z',
      },
    ],
  },
  {
    id: 'req-003',
    request_number: 'REQ-2024-003',
    requester_name: 'Sarah Johnson',
    requester_email: 'sarah.johnson@university.edu',
    requester_type: 'faculty',
    department: 'Business Administration',
    request_date: '2024-03-11T10:00:00Z',
    purpose: 'Office supplies for department',
    status: 'completed',
    priority: 'low',
    reviewed_by: 'Admin User',
    reviewed_at: '2024-03-11T11:00:00Z',
    admin_notes: 'Approved and delivered',
    created_at: '2024-03-11T10:00:00Z',
    updated_at: '2024-03-11T16:00:00Z',
    request_items: [
      {
        id: 'item-003',
        request_id: 'req-003',
        item_name: 'Whiteboard Markers - Black',
        category: 'Office Supplies',
        quantity: 5,
        unit: 'boxes',
        quantity_fulfilled: 5,
        fulfillment_status: 'fulfilled',
        inventory_item_id: '2',
        created_at: '2024-03-11T10:00:00Z',
      },
      {
        id: 'item-004',
        request_id: 'req-003',
        item_name: 'Paper - A4 Ream',
        category: 'Office Supplies',
        quantity: 20,
        unit: 'reams',
        quantity_fulfilled: 20,
        fulfillment_status: 'fulfilled',
        inventory_item_id: '4',
        created_at: '2024-03-11T10:00:00Z',
      },
    ],
  },
  {
    id: 'req-004',
    request_number: 'REQ-2024-004',
    requester_name: 'Michael Tan',
    requester_email: 'michael.tan@university.edu',
    requester_type: 'student',
    student_id: '2022-67890',
    department: 'Information Technology',
    course: 'BS Information Technology',
    year_level: '2nd Year',
    request_date: '2024-03-10T13:20:00Z',
    purpose: 'Equipment for capstone project development',
    status: 'rejected',
    priority: 'urgent',
    reviewed_by: 'Admin User',
    reviewed_at: '2024-03-10T14:30:00Z',
    rejection_reason: 'Insufficient stock available. Please resubmit request in 2 weeks.',
    created_at: '2024-03-10T13:20:00Z',
    updated_at: '2024-03-10T14:30:00Z',
    request_items: [
      {
        id: 'item-005',
        request_id: 'req-004',
        item_name: 'Laptop - Dell XPS 15',
        category: 'Electronics',
        quantity: 10,
        unit: 'units',
        quantity_fulfilled: 0,
        fulfillment_status: 'unavailable',
        inventory_item_id: '1',
        created_at: '2024-03-10T13:20:00Z',
      },
    ],
  },
];

let mockNotifications: Notification[] = [
  {
    id: 'notif-001',
    type: 'critical_stock',
    title: 'Critical Stock Alert',
    message: 'Chemistry Lab Beakers - 500ml is critically low (3 units remaining)',
    severity: 'critical',
    related_item_id: '5',
    related_type: 'inventory',
    is_read: false,
    created_at: '2024-03-13T07:00:00Z',
  },
  {
    id: 'notif-002',
    type: 'low_stock',
    title: 'Low Stock Warning',
    message: 'Whiteboard Markers - Black is below minimum level (8/15)',
    severity: 'warning',
    related_item_id: '2',
    related_type: 'inventory',
    is_read: false,
    created_at: '2024-03-12T09:00:00Z',
  },
  {
    id: 'notif-003',
    type: 'new_request',
    title: 'New Request Submitted',
    message: 'Maria Santos submitted a new high-priority request (REQ-2024-001)',
    severity: 'info',
    related_item_id: 'req-001',
    related_type: 'request',
    is_read: false,
    created_at: '2024-03-13T08:30:00Z',
  },
  {
    id: 'notif-004',
    type: 'low_stock',
    title: 'Low Stock Warning',
    message: 'Projector - Epson PowerLite is below minimum level (5/10)',
    severity: 'warning',
    related_item_id: '3',
    related_type: 'inventory',
    is_read: true,
    read_by: 'Admin User',
    read_at: '2024-03-12T10:00:00Z',
    created_at: '2024-03-11T15:00:00Z',
  },
];

// ============================================================================
// MOCK API FUNCTIONS
// ============================================================================

// Simulates async API calls with delays
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// ----------------------------------------------------------------------------
// INVENTORY API
// ----------------------------------------------------------------------------

export const inventoryAPI = {
  async getAll() {
    await delay(300);
    return [...mockInventory];
  },

  async getById(id: string) {
    await delay(200);
    const item = mockInventory.find(i => i.id === id);
    if (!item) throw new Error('Item not found');
    return item;
  },

  async getLowStock() {
    await delay(300);
    return mockInventory.filter(item => item.current_stock < item.minimum_stock_level);
  },

  async search(query: string) {
    await delay(300);
    const lowerQuery = query.toLowerCase();
    return mockInventory.filter(item =>
      item.name.toLowerCase().includes(lowerQuery) ||
      item.category.toLowerCase().includes(lowerQuery) ||
      item.description?.toLowerCase().includes(lowerQuery)
    );
  },

  async getByCategory(category: string) {
    await delay(300);
    return mockInventory.filter(item => item.category === category);
  },

  async create(item: Partial<InventoryItem>) {
    await delay(400);
    const newItem: InventoryItem = {
      id: `item-${Date.now()}`,
      name: item.name || '',
      category: item.category || '',
      unit_of_measurement: item.unit_of_measurement || 'units',
      current_stock: item.current_stock || 0,
      minimum_stock_level: item.minimum_stock_level || 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ...item,
    } as InventoryItem;
    mockInventory.push(newItem);
    return newItem;
  },

  async update(id: string, updates: Partial<InventoryItem>) {
    await delay(400);
    const index = mockInventory.findIndex(i => i.id === id);
    if (index === -1) throw new Error('Item not found');
    mockInventory[index] = {
      ...mockInventory[index],
      ...updates,
      updated_at: new Date().toISOString(),
    };
    return mockInventory[index];
  },

  async delete(id: string) {
    await delay(300);
    const index = mockInventory.findIndex(i => i.id === id);
    if (index === -1) throw new Error('Item not found');
    mockInventory.splice(index, 1);
  },
};

// ----------------------------------------------------------------------------
// REQUEST API
// ----------------------------------------------------------------------------

export const requestsAPI = {
  async getAll() {
    await delay(400);
    return [...mockRequests];
  },

  async getByStatus(status: string) {
    await delay(300);
    return mockRequests.filter(req => req.status === status);
  },

  async getById(id: string) {
    await delay(200);
    const request = mockRequests.find(r => r.id === id);
    if (!request) throw new Error('Request not found');
    return request;
  },

  async create(request: Partial<Request>, items: Partial<RequestItem>[]) {
    await delay(500);
    const requestId = `req-${Date.now()}`;
    const requestNumber = `REQ-2024-${String(mockRequests.length + 1).padStart(3, '0')}`;
    
    const newRequest: Request = {
      id: requestId,
      request_number: requestNumber,
      requester_name: request.requester_name || '',
      requester_email: request.requester_email || '',
      requester_type: request.requester_type || 'student',
      department: request.department || '',
      request_date: new Date().toISOString(),
      purpose: request.purpose || '',
      status: 'pending',
      priority: request.priority || 'normal',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ...request,
    } as Request;

    const newItems: RequestItem[] = items.map((item, index) => ({
      id: `item-${Date.now()}-${index}`,
      request_id: requestId,
      item_name: item.item_name || '',
      category: item.category || '',
      quantity: item.quantity || 0,
      unit: item.unit || 'units',
      quantity_fulfilled: 0,
      fulfillment_status: 'pending',
      created_at: new Date().toISOString(),
      ...item,
    } as RequestItem));

    newRequest.request_items = newItems;
    mockRequests.unshift(newRequest);
    
    return { request: newRequest, items: newItems };
  },

  async updateStatus(
    id: string,
    status: string,
    reviewedBy: string,
    adminNotes?: string,
    rejectionReason?: string
  ) {
    await delay(400);
    const index = mockRequests.findIndex(r => r.id === id);
    if (index === -1) throw new Error('Request not found');
    
    mockRequests[index] = {
      ...mockRequests[index],
      status: status as any,
      reviewed_by: reviewedBy,
      reviewed_at: new Date().toISOString(),
      admin_notes: adminNotes,
      rejection_reason: rejectionReason,
      updated_at: new Date().toISOString(),
    };
    
    return mockRequests[index];
  },

  async search(query: string) {
    await delay(300);
    const lowerQuery = query.toLowerCase();
    return mockRequests.filter(req =>
      req.requester_name.toLowerCase().includes(lowerQuery) ||
      req.requester_email.toLowerCase().includes(lowerQuery) ||
      req.request_number.toLowerCase().includes(lowerQuery) ||
      req.department.toLowerCase().includes(lowerQuery)
    );
  },
};

// ----------------------------------------------------------------------------
// NOTIFICATIONS API
// ----------------------------------------------------------------------------

export const notificationsAPI = {
  async getUnread() {
    await delay(200);
    return mockNotifications.filter(n => !n.is_read);
  },

  async markAsRead(id: string, readBy: string) {
    await delay(200);
    const index = mockNotifications.findIndex(n => n.id === id);
    if (index === -1) throw new Error('Notification not found');
    
    mockNotifications[index] = {
      ...mockNotifications[index],
      is_read: true,
      read_by: readBy,
      read_at: new Date().toISOString(),
    };
    
    return mockNotifications[index];
  },

  async getAll(limit = 100) {
    await delay(200);
    return mockNotifications.slice(0, limit);
  },
};

// ----------------------------------------------------------------------------
// ANALYTICS API
// ----------------------------------------------------------------------------

export const analyticsAPI = {
  async getRequestStats(days = 30) {
    await delay(400);
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - days);
    
    return mockRequests
      .filter(req => new Date(req.created_at) >= fromDate)
      .map(req => ({
        status: req.status,
        department: req.department,
        created_at: req.created_at,
      }));
  },

  async getTopRequestedItems(limit = 10) {
    await delay(400);
    const itemCounts: Record<string, any> = {};
    
    mockRequests.forEach(req => {
      req.request_items?.forEach(item => {
        if (!itemCounts[item.item_name]) {
          itemCounts[item.item_name] = {
            name: item.item_name,
            category: item.category,
            requests: 0,
            totalQuantity: 0,
          };
        }
        itemCounts[item.item_name].requests++;
        itemCounts[item.item_name].totalQuantity += item.quantity;
      });
    });
    
    return Object.values(itemCounts)
      .sort((a: any, b: any) => b.requests - a.requests)
      .slice(0, limit);
  },

  async getTotalStockValue() {
    await delay(300);
    return mockInventory.reduce((sum, item) => {
      return sum + (item.current_stock * (item.price_per_unit || 0));
    }, 0);
  },
};
