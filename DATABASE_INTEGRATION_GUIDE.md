# Database Integration Guide - PostgreSQL

This document outlines where to integrate your PostgreSQL database in the Inventory Management System.

## Overview

All dummy/mock data has been removed from the system and replaced with empty arrays. Each file contains detailed comments indicating where to add your PostgreSQL database queries.

---

## Files Modified

### 1. Dashboard.tsx (`/src/app/pages/Dashboard.tsx`)

**Empty Data Arrays:**
- `mockRequests` - User requests data
- `lowStockItems` - Inventory items below minimum stock

**Database Integration Points:**

#### Requests Table
```sql
CREATE TABLE requests (
  id VARCHAR PRIMARY KEY,
  requester_name VARCHAR,
  email VARCHAR,
  department VARCHAR,
  date TIMESTAMP,
  status VARCHAR CHECK (status IN ('pending', 'approved', 'rejected', 'completed')),
  priority VARCHAR CHECK (priority IN ('low', 'medium', 'high')),
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE request_items (
  id SERIAL PRIMARY KEY,
  request_id VARCHAR REFERENCES requests(id),
  item_name VARCHAR,
  quantity INTEGER,
  category VARCHAR
);
```

#### Example Query
```javascript
const mockRequests = await db.query(
  'SELECT * FROM requests ORDER BY created_at DESC LIMIT 10'
);
```

---

### 2. InboxPage.tsx (`/src/app/pages/InboxPage.tsx`)

**Empty Data Arrays:**
- `mockRequests` - Full list of user requests with items

**Database Integration Points:**

#### Complex Query with JOIN
```javascript
const mockRequests = await db.query(`
  SELECT r.*, 
         json_agg(json_build_object(
           'name', ri.item_name, 
           'quantity', ri.quantity, 
           'category', ri.category
         )) as items
  FROM requests r
  LEFT JOIN request_items ri ON r.id = ri.request_id
  GROUP BY r.id
  ORDER BY r.created_at DESC
`);
```

---

### 3. InventoryPage.tsx (`/src/app/pages/InventoryPage.tsx`)

**Empty Data Arrays:**
- `mockInventory` - Inventory items tracking

**Database Integration Points:**

#### Inventory Table Schema
```sql
CREATE TABLE inventory (
  id VARCHAR PRIMARY KEY,
  name VARCHAR NOT NULL,
  category VARCHAR,
  current_stock INTEGER DEFAULT 0,
  minimum_stock INTEGER DEFAULT 0,
  unit VARCHAR,
  last_restocked DATE,
  next_resupply DATE,
  price_per_unit NUMERIC(10, 2),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### Example Queries

**Fetch Inventory:**
```javascript
const mockInventory = await db.query(`
  SELECT id, name, category, current_stock as "currentStock", 
         minimum_stock as "minimumStock", unit, 
         last_restocked as "lastRestocked", 
         next_resupply as "nextResupply", 
         price_per_unit as "pricePerUnit"
  FROM inventory
  ORDER BY name ASC
`);
```

**Update Stock (Restock):**
```javascript
await db.query(`
  UPDATE inventory 
  SET current_stock = current_stock + $1, 
      last_restocked = CURRENT_DATE,
      next_resupply = $2,
      updated_at = CURRENT_TIMESTAMP
  WHERE id = $3
`, [restockAmount, nextResupplyDate, itemId]);
```

---

### 4. AnalyticsPage.tsx (`/src/app/pages/AnalyticsPage.tsx`)

**Empty Data Arrays:**
- `weeklyRequestData` - Weekly request statistics
- `monthlyTrendData` - Monthly trends
- `categoryDistribution` - Category-wise distribution
- `topRequestedItems` - Most requested items
- `departmentActivity` - Department-wise request activity

**Database Integration Points:**

#### Weekly Requests
```javascript
const weeklyRequestData = await db.query(`
  SELECT 
    TO_CHAR(created_at, 'Day') as day,
    COUNT(*) as requests,
    COUNT(*) FILTER (WHERE status = 'approved') as approved,
    COUNT(*) FILTER (WHERE status = 'rejected') as rejected
  FROM requests
  WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'
  GROUP BY TO_CHAR(created_at, 'Day'), EXTRACT(DOW FROM created_at)
  ORDER BY EXTRACT(DOW FROM created_at)
`);
```

#### Monthly Trends
```javascript
const monthlyTrendData = await db.query(`
  SELECT 
    TO_CHAR(created_at, 'Mon') as month,
    COUNT(DISTINCT ri.id) as items,
    SUM(i.price_per_unit * ri.quantity) as value
  FROM requests r
  JOIN request_items ri ON r.id = ri.request_id
  JOIN inventory i ON ri.item_name = i.name
  WHERE created_at >= CURRENT_DATE - INTERVAL '6 months'
  GROUP BY TO_CHAR(created_at, 'Mon'), EXTRACT(MONTH FROM created_at)
  ORDER BY EXTRACT(MONTH FROM created_at)
`);
```

#### Category Distribution
```javascript
const categoryDistribution = await db.query(`
  SELECT 
    ri.category as name,
    COUNT(*) as value
  FROM request_items ri
  GROUP BY ri.category
  ORDER BY value DESC
`);
```

#### Top Requested Items
```javascript
const topRequestedItems = await db.query(`
  SELECT 
    item_name as name,
    COUNT(*) as requests
  FROM request_items
  GROUP BY item_name
  ORDER BY requests DESC
  LIMIT 10
`);
```

#### Department Activity
```javascript
const departmentActivity = await db.query(`
  SELECT 
    department as dept,
    COUNT(*) as requests
  FROM requests
  GROUP BY department
  ORDER BY requests DESC
`);
```

---

## Complete Database Schema

Here's the complete PostgreSQL schema for your inventory management system:

```sql
-- Requests Table
CREATE TABLE requests (
  id VARCHAR PRIMARY KEY,
  requester_name VARCHAR NOT NULL,
  email VARCHAR NOT NULL,
  department VARCHAR NOT NULL,
  date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  status VARCHAR CHECK (status IN ('pending', 'approved', 'rejected', 'completed')) DEFAULT 'pending',
  priority VARCHAR CHECK (priority IN ('low', 'medium', 'high')) DEFAULT 'medium',
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Request Items Table
CREATE TABLE request_items (
  id SERIAL PRIMARY KEY,
  request_id VARCHAR REFERENCES requests(id) ON DELETE CASCADE,
  item_name VARCHAR NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  category VARCHAR NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Inventory Table
CREATE TABLE inventory (
  id VARCHAR PRIMARY KEY,
  name VARCHAR NOT NULL UNIQUE,
  category VARCHAR NOT NULL,
  current_stock INTEGER DEFAULT 0 CHECK (current_stock >= 0),
  minimum_stock INTEGER DEFAULT 0 CHECK (minimum_stock >= 0),
  unit VARCHAR NOT NULL,
  last_restocked DATE,
  next_resupply DATE,
  price_per_unit NUMERIC(10, 2) CHECK (price_per_unit >= 0),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for Performance
CREATE INDEX idx_requests_status ON requests(status);
CREATE INDEX idx_requests_created_at ON requests(created_at DESC);
CREATE INDEX idx_requests_department ON requests(department);
CREATE INDEX idx_request_items_request_id ON request_items(request_id);
CREATE INDEX idx_inventory_category ON inventory(category);
CREATE INDEX idx_inventory_low_stock ON inventory(current_stock, minimum_stock) 
  WHERE current_stock < minimum_stock;

-- Triggers for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_requests_updated_at 
  BEFORE UPDATE ON requests 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_inventory_updated_at 
  BEFORE UPDATE ON inventory 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();
```

---

## Report Types Implementation

The system supports three report types as per your requirements:

### 1. RIS Weekly Report
- Query weekly request data
- Show approved/rejected/pending breakdown
- Include department-wise distribution

### 2. Monthly Report
- Aggregate monthly trends
- Show inventory value changes
- Track top requested items

### 3. SSMI (Stock Status & Management Insights)
- Low stock alerts
- Restock recommendations
- Category-wise inventory health

---

## Connection Setup

You'll need to set up a PostgreSQL client. Here's an example using `pg` library:

```javascript
import { Pool } from 'pg';

const pool = new Pool({
  user: 'your_username',
  host: 'localhost',
  database: 'inventory_db',
  password: 'your_password',
  port: 5432,
});

export const db = {
  query: (text, params) => pool.query(text, params)
};
```

---

## Next Steps

1. **Set up PostgreSQL database**
2. **Run the schema creation scripts**
3. **Install pg library**: `npm install pg @types/pg`
4. **Create a database connection file**
5. **Replace empty arrays in each component with actual queries**
6. **Test each page individually**

All the integration points are clearly marked in the source code with:
```
// ============================================================================
// DATABASE INTEGRATION: PostgreSQL
// ============================================================================
```

Good luck with your database integration!
