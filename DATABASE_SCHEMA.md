# FacilityLink Database Schema (Supabase/PostgreSQL)

This document outlines the complete database architecture for the FacilityLink: Centralized Inventory System.

## Database Platform
**Supabase** (PostgreSQL with built-in authentication, real-time subscriptions, and REST API)

---

## Tables Overview

### 1. `inventory` - Inventory Items Master Table
Stores all inventory items with stock levels and specifications.

```sql
CREATE TABLE inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  subcategory TEXT,
  unit_of_measurement TEXT NOT NULL, -- e.g., 'pcs', 'kg', 'L', 'box'
  current_stock INTEGER NOT NULL DEFAULT 0,
  minimum_stock_level INTEGER NOT NULL DEFAULT 10,
  maximum_stock_level INTEGER,
  price_per_unit DECIMAL(10, 2),
  location TEXT, -- Storage location
  description TEXT,
  barcode TEXT UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  CONSTRAINT positive_stock CHECK (current_stock >= 0),
  CONSTRAINT positive_min_stock CHECK (minimum_stock_level >= 0)
);

-- Indexes for performance
CREATE INDEX idx_inventory_category ON inventory(category);
CREATE INDEX idx_inventory_stock_level ON inventory(current_stock);
CREATE INDEX idx_inventory_name ON inventory(name);
```

**Stock Status Calculation** (application logic):
- `critical`: `current_stock < minimum_stock_level * 0.5`
- `low`: `current_stock < minimum_stock_level`
- `good`: `current_stock >= minimum_stock_level`

---

### 2. `requests` - User Requests Table
Stores all inventory requests from students/faculty.

```sql
CREATE TABLE requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_number TEXT UNIQUE NOT NULL, -- Auto-generated: REQ-YYYYMMDD-XXXX
  
  -- Requester Information
  requester_name TEXT NOT NULL,
  requester_email TEXT NOT NULL,
  requester_type TEXT NOT NULL, -- 'student' or 'faculty'
  student_id TEXT, -- Required if requester_type = 'student'
  department TEXT NOT NULL,
  course TEXT, -- Required if requester_type = 'student'
  year_level TEXT, -- Required if requester_type = 'student'
  
  -- Request Details
  request_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  purpose TEXT NOT NULL,
  notes TEXT,
  
  -- Status Management
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'approved', 'rejected', 'completed'
  priority TEXT DEFAULT 'normal', -- 'low', 'normal', 'high', 'urgent'
  
  -- Admin Response
  reviewed_by TEXT, -- Admin email/name
  reviewed_at TIMESTAMP WITH TIME ZONE,
  admin_notes TEXT,
  rejection_reason TEXT,
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  CONSTRAINT valid_status CHECK (status IN ('pending', 'approved', 'rejected', 'completed')),
  CONSTRAINT valid_requester_type CHECK (requester_type IN ('student', 'faculty')),
  CONSTRAINT valid_priority CHECK (priority IN ('low', 'normal', 'high', 'urgent'))
);

-- Indexes
CREATE INDEX idx_requests_status ON requests(status);
CREATE INDEX idx_requests_date ON requests(request_date DESC);
CREATE INDEX idx_requests_requester_email ON requests(requester_email);
CREATE INDEX idx_requests_department ON requests(department);
```

---

### 3. `request_items` - Individual Items per Request
Links requests to specific inventory items with quantities.

```sql
CREATE TABLE request_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
  
  -- Item Details
  item_name TEXT NOT NULL,
  category TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  unit TEXT NOT NULL,
  
  -- Fulfillment
  quantity_fulfilled INTEGER DEFAULT 0,
  fulfillment_status TEXT DEFAULT 'pending', -- 'pending', 'partial', 'fulfilled', 'unavailable'
  
  -- Inventory Link (if item exists in inventory)
  inventory_item_id UUID REFERENCES inventory(id) ON DELETE SET NULL,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  CONSTRAINT positive_quantity CHECK (quantity > 0),
  CONSTRAINT valid_fulfillment_status CHECK (fulfillment_status IN ('pending', 'partial', 'fulfilled', 'unavailable'))
);

-- Indexes
CREATE INDEX idx_request_items_request ON request_items(request_id);
CREATE INDEX idx_request_items_category ON request_items(category);
CREATE INDEX idx_request_items_name ON request_items(item_name);
```

---

### 4. `stock_movements` - Stock Transaction History
Tracks all stock changes for audit and analytics.

```sql
CREATE TABLE stock_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inventory_item_id UUID NOT NULL REFERENCES inventory(id) ON DELETE CASCADE,
  
  -- Movement Details
  movement_type TEXT NOT NULL, -- 'IN' (restock), 'OUT' (issued), 'ADJUSTMENT' (manual correction)
  quantity INTEGER NOT NULL, -- Positive for IN, negative for OUT
  previous_stock INTEGER NOT NULL,
  new_stock INTEGER NOT NULL,
  
  -- Context
  reference_type TEXT, -- 'request', 'purchase', 'adjustment', 'return'
  reference_id UUID, -- Links to requests.id or other tables
  
  -- Metadata
  performed_by TEXT NOT NULL, -- Admin email/name
  reason TEXT,
  notes TEXT,
  movement_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  CONSTRAINT valid_movement_type CHECK (movement_type IN ('IN', 'OUT', 'ADJUSTMENT'))
);

-- Indexes
CREATE INDEX idx_stock_movements_item ON stock_movements(inventory_item_id);
CREATE INDEX idx_stock_movements_date ON stock_movements(movement_date DESC);
CREATE INDEX idx_stock_movements_type ON stock_movements(movement_type);
```

---

### 5. `categories` - Item Categories Master List
Predefined categories for inventory items.

```sql
CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  description TEXT,
  icon TEXT, -- Icon name from lucide-react
  color TEXT, -- Hex color code
  subcategories TEXT[], -- Array of subcategory names
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Sample Data
INSERT INTO categories (name, description, icon, color, subcategories) VALUES
('Office Supplies', 'General office materials', 'Pencil', '#3b82f6', ARRAY['Pens & Pencils', 'Paper Products', 'Organizers']),
('Cleaning Materials', 'Janitorial and cleaning supplies', 'Sparkles', '#10b981', ARRAY['Detergents', 'Tools', 'Disinfectants']),
('Laboratory Equipment', 'Scientific lab tools and materials', 'Flask', '#8b5cf6', ARRAY['Glassware', 'Instruments', 'Chemicals']),
('Computer Hardware', 'IT and computer equipment', 'Monitor', '#f59e0b', ARRAY['Peripherals', 'Components', 'Cables']),
('Classroom Supplies', 'Teaching and learning materials', 'BookOpen', '#ec4899', ARRAY['Boards & Markers', 'Educational Tools']);
```

---

### 6. `admin_users` - Admin Authentication
Stores admin login credentials and permissions.

```sql
CREATE TABLE admin_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL, -- Use bcrypt or Supabase Auth
  full_name TEXT NOT NULL,
  role TEXT DEFAULT 'admin', -- 'admin', 'super_admin'
  is_active BOOLEAN DEFAULT true,
  last_login TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  CONSTRAINT valid_role CHECK (role IN ('admin', 'super_admin'))
);
```

---

### 7. `notifications` - System Notifications
Tracks alerts for low stock and other system events.

```sql
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL, -- 'low_stock', 'critical_stock', 'new_request', 'request_update'
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  severity TEXT DEFAULT 'info', -- 'info', 'warning', 'critical'
  
  -- Links
  related_item_id UUID, -- inventory.id or requests.id
  related_type TEXT, -- 'inventory' or 'request'
  
  -- Status
  is_read BOOLEAN DEFAULT false,
  read_at TIMESTAMP WITH TIME ZONE,
  read_by TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  CONSTRAINT valid_type CHECK (type IN ('low_stock', 'critical_stock', 'new_request', 'request_update')),
  CONSTRAINT valid_severity CHECK (severity IN ('info', 'warning', 'critical'))
);

-- Index
CREATE INDEX idx_notifications_unread ON notifications(is_read, created_at DESC);
```

---

## Row Level Security (RLS) Policies

### Enable RLS on all tables
```sql
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE request_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
```

### Public Access Policies (for user request page)
```sql
-- Allow public read on categories
CREATE POLICY "Allow public read categories" ON categories
  FOR SELECT USING (is_active = true);

-- Allow public read on inventory (for checking availability)
CREATE POLICY "Allow public read inventory" ON inventory
  FOR SELECT USING (true);

-- Allow public insert on requests (for submitting requests)
CREATE POLICY "Allow public insert requests" ON requests
  FOR INSERT WITH CHECK (true);

-- Allow public insert on request_items
CREATE POLICY "Allow public insert request_items" ON request_items
  FOR INSERT WITH CHECK (true);
```

### Admin Access Policies
```sql
-- Admin users can do everything on all tables
-- (Implement with Supabase Auth and user roles)
```

---

## Database Functions

### 1. Auto-generate Request Number
```sql
CREATE OR REPLACE FUNCTION generate_request_number()
RETURNS TRIGGER AS $$
BEGIN
  NEW.request_number := 'REQ-' || 
    TO_CHAR(NOW(), 'YYYYMMDD') || '-' || 
    LPAD(NEXTVAL('request_number_seq')::TEXT, 4, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Sequence for request numbers
CREATE SEQUENCE request_number_seq;

-- Trigger
CREATE TRIGGER set_request_number
  BEFORE INSERT ON requests
  FOR EACH ROW
  EXECUTE FUNCTION generate_request_number();
```

### 2. Update Inventory Stock Trigger
```sql
CREATE OR REPLACE FUNCTION update_inventory_stock()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE inventory
  SET 
    current_stock = NEW.new_stock,
    updated_at = NOW()
  WHERE id = NEW.inventory_item_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER apply_stock_movement
  AFTER INSERT ON stock_movements
  FOR EACH ROW
  EXECUTE FUNCTION update_inventory_stock();
```

### 3. Check Low Stock and Create Notifications
```sql
CREATE OR REPLACE FUNCTION check_low_stock()
RETURNS TRIGGER AS $$
BEGIN
  -- Critical stock alert (below 50% of minimum)
  IF NEW.current_stock < (NEW.minimum_stock_level * 0.5) THEN
    INSERT INTO notifications (type, title, message, severity, related_item_id, related_type)
    VALUES (
      'critical_stock',
      'Critical Stock Alert',
      'Item "' || NEW.name || '" has critical stock level: ' || NEW.current_stock || ' ' || NEW.unit_of_measurement,
      'critical',
      NEW.id,
      'inventory'
    );
  -- Low stock alert
  ELSIF NEW.current_stock < NEW.minimum_stock_level THEN
    INSERT INTO notifications (type, title, message, severity, related_item_id, related_type)
    VALUES (
      'low_stock',
      'Low Stock Alert',
      'Item "' || NEW.name || '" is running low: ' || NEW.current_stock || ' ' || NEW.unit_of_measurement,
      'warning',
      NEW.id,
      'inventory'
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER monitor_stock_levels
  AFTER UPDATE OF current_stock ON inventory
  FOR EACH ROW
  EXECUTE FUNCTION check_low_stock();
```

### 4. Notify on New Request
```sql
CREATE OR REPLACE FUNCTION notify_new_request()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO notifications (type, title, message, severity, related_item_id, related_type)
  VALUES (
    'new_request',
    'New Inventory Request',
    'New request from ' || NEW.requester_name || ' (' || NEW.department || ')',
    'info',
    NEW.id,
    'request'
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER alert_new_request
  AFTER INSERT ON requests
  FOR EACH ROW
  EXECUTE FUNCTION notify_new_request();
```

---

## Sample Queries

### Get pending requests with item count
```sql
SELECT 
  r.id,
  r.request_number,
  r.requester_name,
  r.department,
  r.request_date,
  r.status,
  COUNT(ri.id) as item_count
FROM requests r
LEFT JOIN request_items ri ON r.id = ri.request_id
WHERE r.status = 'pending'
GROUP BY r.id
ORDER BY r.request_date DESC;
```

### Get low stock items
```sql
SELECT 
  name,
  category,
  current_stock,
  minimum_stock_level,
  unit_of_measurement,
  ROUND((current_stock::DECIMAL / minimum_stock_level) * 100, 1) as stock_percentage
FROM inventory
WHERE current_stock < minimum_stock_level
ORDER BY stock_percentage ASC;
```

### Get request statistics by department
```sql
SELECT 
  department,
  COUNT(*) as total_requests,
  COUNT(*) FILTER (WHERE status = 'approved') as approved,
  COUNT(*) FILTER (WHERE status = 'rejected') as rejected,
  COUNT(*) FILTER (WHERE status = 'pending') as pending
FROM requests
WHERE request_date >= NOW() - INTERVAL '30 days'
GROUP BY department
ORDER BY total_requests DESC;
```

---

## Environment Variables

Add to `.env` file:
```
REACT_APP_SUPABASE_URL=your_supabase_project_url
REACT_APP_SUPABASE_KEY=your_supabase_anon_key
```
