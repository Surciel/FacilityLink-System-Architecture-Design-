# FacilityLink UI-Only Setup Guide

This guide explains how to use the FacilityLink frontend **without backend integration** using mock data.

---

## ✅ What's Included

### Files You Need:

1. **6 Page Components** (Already configured to use mock data)
   - `src/app/pages/UserRequestPage.tsx`
   - `src/app/pages/AdminLogin.tsx`
   - `src/app/pages/Dashboard.tsx`
   - `src/app/pages/InboxPage.tsx`
   - `src/app/pages/InventoryPage.tsx`
   - `src/app/pages/AnalyticsPage.tsx`

2. **Mock Data Layer**
   - `src/lib/mockData.ts` - Simulates database with in-memory data

3. **50+ UI Components**
   - All components in `src/app/components/ui/`

4. **Styling**
   - All files in `src/styles/`

5. **Documentation**
   - `DATABASE_SCHEMA.md` - Complete database schema for future integration
   - `DATABASE_INTEGRATION_GUIDE.md` - How to connect real database later
   - `guidelines/Guidelines.md` - Original requirements

---

## 🎯 Current Setup

### All Pages Use Mock Data

The 6 pages are **already configured** to import from `mockData.ts` instead of the real Supabase backend:

```typescript
// All pages import from mockData.ts
import { 
  inventoryAPI, 
  requestsAPI, 
  notificationsAPI, 
  analyticsAPI 
} from '../lib/mockData';
```

### Mock Data Features

✅ **Simulates real API calls** with delays (200-500ms)  
✅ **Persistent during session** - Changes stay in memory  
✅ **Realistic data** - 5 inventory items, 4 requests, 4 notifications  
✅ **Full CRUD operations** - Create, Read, Update, Delete all work  
✅ **Same API interface** - Easy to swap with real database later  

---

## 📦 Installation & Setup

### 1. Clone/Download Files

```bash
# Navigate to your repo
cd FacilityLink-System-Architecture-Design-

# Create frontend directory
mkdir -p frontend

# Copy all files from Figma Make to frontend/
# (Use export feature or manual copy)
```

### 2. Install Dependencies

```bash
cd frontend
npm install
```

### 3. Run Development Server

```bash
npm run dev
```

The app will run at `http://localhost:5173` (or similar)

---

## 🚀 How It Works

### Mock Data Storage

All data is stored in JavaScript arrays in `mockData.ts`:

```typescript
let mockInventory: InventoryItem[] = [/* 5 sample items */];
let mockRequests: Request[] = [/* 4 sample requests */];
let mockNotifications: Notification[] = [/* 4 notifications */];
```

### API Functions

Mock API functions simulate async database calls:

```typescript
// Simulated delay (300ms)
async getAll() {
  await delay(300);
  return [...mockInventory];
}
```

### Usage in Pages

Pages use the **exact same code** as they would with a real database:

```typescript
// Works identically with mock or real database
const loadInventory = async () => {
  try {
    const data = await inventoryAPI.getAll();
    setInventory(data);
  } catch (error) {
    console.error(error);
  }
};
```

---

## 📊 Sample Data Included

### Inventory Items (5 items):
1. Laptop - Dell XPS 15 (45 units)
2. Whiteboard Markers - Black (**LOW STOCK**: 8/15)
3. Projector - Epson PowerLite (**LOW STOCK**: 5/10)
4. Paper - A4 Ream (120 reams)
5. Chemistry Lab Beakers - 500ml (**CRITICAL**: 3/20)

### Requests (4 requests):
1. **REQ-2024-001** - Pending (High Priority) - Maria Santos
2. **REQ-2024-002** - Approved - John dela Cruz
3. **REQ-2024-003** - Completed - Sarah Johnson
4. **REQ-2024-004** - Rejected - Michael Tan

### Notifications (4 alerts):
1. Critical Stock Alert - Chemistry Beakers
2. Low Stock Warning - Whiteboard Markers
3. New Request - Maria Santos
4. Low Stock Warning - Projector (read)

---

## 🔄 Features That Work

### ✅ Fully Functional (No Backend Needed):

- **User Request Page**
  - Submit new requests ✅
  - Add multiple items ✅
  - Form validation ✅
  - Success confirmation ✅

- **Admin Login**
  - Login form (accepts any credentials for demo) ✅
  - Redirects to dashboard ✅

- **Dashboard**
  - Display pending requests ✅
  - Show low stock alerts ✅
  - View notifications ✅
  - Quick stats ✅

- **Inbox Page**
  - View all requests ✅
  - Filter by status ✅
  - Search requests ✅
  - Approve/Reject requests ✅
  - View request details ✅

- **Inventory Page**
  - View all items ✅
  - Filter by category ✅
  - Search items ✅
  - Add new items ✅
  - Edit items ✅
  - Delete items ✅
  - Stock level indicators ✅

- **Analytics Page**
  - Request statistics ✅
  - Top requested items ✅
  - Stock value calculation ✅
  - Department breakdown ✅
  - Charts and graphs ✅

### ⚠️ Limitations (Mock Data):

- ❌ **Not persistent** - Refreshing page resets data
- ❌ **No authentication** - Login accepts any credentials
- ❌ **No file uploads** - Image uploads won't save
- ❌ **No real-time sync** - Changes don't sync across tabs
- ❌ **Single user** - No multi-user support

---

## 🔌 Migrating to Real Database Later

### Step 1: Choose Your Database

The system is designed to work with **any database**. See `DATABASE_INTEGRATION_GUIDE.md` for options:

- Supabase (PostgreSQL)
- Firebase
- MongoDB
- MySQL
- Custom REST API

### Step 2: Create Database Tables

Use the schema in `DATABASE_SCHEMA.md` to create tables:

- `inventory`
- `requests`
- `request_items`
- `stock_movements`
- `categories`
- `notifications`

### Step 3: Create Real API Layer

**Option A: Use Supabase**
```bash
# Copy the Supabase integration file
cp supabaseFigma.ts src/lib/supabase.ts

# Add environment variables
REACT_APP_SUPABASE_URL=your-url
REACT_APP_SUPABASE_KEY=your-key
```

**Option B: Create Custom API**
```typescript
// src/lib/api.ts
export const inventoryAPI = {
  async getAll() {
    const response = await fetch('/api/inventory');
    return response.json();
  },
  // ... other functions
};
```

### Step 4: Update Imports in Pages

Change one line in each page:

```typescript
// Before (mock data)
import { inventoryAPI } from '../lib/mockData';

// After (real database)
import { inventoryAPI } from '../lib/supabase';  // or '../lib/api'
```

**That's it!** The rest of the code stays the same because the API interface is identical.

---

## 🧪 Testing the UI

### Test Scenarios:

1. **Submit a Request**
   - Go to `http://localhost:5173/`
   - Fill out the request form
   - Add items
   - Submit
   - Check Dashboard/Inbox to see new request

2. **Manage Inventory**
   - Go to `/admin/inventory`
   - Add a new item
   - Edit existing item
   - Delete an item
   - Search and filter

3. **Process Requests**
   - Go to `/admin/inbox`
   - Click on a pending request
   - Approve or reject it
   - See status change

4. **View Analytics**
   - Go to `/admin/analytics`
   - See charts and statistics
   - Filter by date range

---

## 📁 File Structure

```
frontend/
├── src/
│   ├── app/
│   │   ├── pages/                    # 6 main pages
│   │   ├── components/
│   │   │   ├── figma/               # Image components
│   │   │   └── ui/                  # 50+ UI components
│   │   ├── App.tsx                  # Main app
│   │   └── routes.ts                # Routing
│   ├── lib/
│   │   ├── mockData.ts              # ✅ Mock database (current)
│   │   └── supabaseFigma.ts         # ⏸️ Real database (for later)
│   └── styles/                      # CSS files
├── docs/
│   ├── DATABASE_SCHEMA.md           # Database structure
│   └── DATABASE_INTEGRATION_GUIDE.md # Integration guide
└── package.json
```

---

## 🎨 Customization

### Add More Mock Data

Edit `src/lib/mockData.ts`:

```typescript
// Add more inventory items
let mockInventory: InventoryItem[] = [
  // ... existing items
  {
    id: '6',
    name: 'Your New Item',
    category: 'Electronics',
    // ... other fields
  },
];
```

### Modify Mock Behavior

Change API delay times:

```typescript
// Faster response (100ms instead of 300ms)
async getAll() {
  await delay(100);  // Change this number
  return [...mockInventory];
}
```

### Add New API Functions

```typescript
export const inventoryAPI = {
  // ... existing functions
  
  // New custom function
  async getByCategoryAndLowStock(category: string) {
    await delay(300);
    return mockInventory.filter(item => 
      item.category === category && 
      item.current_stock < item.minimum_stock_level
    );
  },
};
```

---

## 🚀 Deployment (UI-Only)

### Deploy to Vercel/Netlify:

```bash
# Build production version
npm run build

# Deploy (example with Vercel)
vercel deploy

# Or Netlify
netlify deploy --prod
```

The UI will work fully without any backend!

---

## ✅ Checklist for Committing

- [ ] All 6 pages work correctly
- [ ] Mock data displays properly
- [ ] Forms submit successfully
- [ ] Filtering/search works
- [ ] Charts render in Analytics
- [ ] No console errors
- [ ] Responsive on mobile
- [ ] Admin routes protected
- [ ] Documentation included

---

## 📝 Commit Message Template

```bash
git add .
git commit -m "Add FacilityLink frontend UI (mock data version)

Features:
- 6 fully functional pages with mock data
- User request submission form
- Admin dashboard with inbox preview
- Full request management inbox
- Inventory tracking and management
- Analytics and reporting with charts
- 50+ reusable UI components
- Responsive design (mobile/tablet/desktop)
- Mock data layer for development

Tech Stack:
- React 18 + TypeScript
- React Router v6
- Tailwind CSS v4
- Recharts for analytics
- Lucide React for icons

Ready for real database integration using DATABASE_INTEGRATION_GUIDE.md

No backend required - fully functional UI for development and testing"
```

---

## 🔗 Next Steps

1. ✅ Test all pages thoroughly
2. ✅ Commit to `frontend/ui-only` branch
3. ✅ Push to GitHub
4. ⏸️ Set up real database (when ready)
5. ⏸️ Follow `DATABASE_INTEGRATION_GUIDE.md`
6. ⏸️ Swap `mockData.ts` for real API
7. ⏸️ Test with real data
8. ⏸️ Deploy production version

---

## ❓ FAQ

**Q: Will my changes persist?**  
A: No, mock data resets on page refresh. Use localStorage if you need persistence, or connect a real database.

**Q: Can multiple users use the system?**  
A: Not with mock data. Each user sees their own in-memory data. Real database needed for multi-user.

**Q: Does authentication work?**  
A: The login form exists but accepts any credentials. Real auth needs backend.

**Q: Can I export data?**  
A: Yes! Use the export buttons in Analytics page. Data downloads as CSV/JSON.

**Q: How do I add more sample data?**  
A: Edit the arrays in `src/lib/mockData.ts` and add more objects.

---

## 🎯 Summary

✅ **UI is 100% functional** with mock data  
✅ **No backend required** for development  
✅ **Easy to migrate** to real database later  
✅ **Same code works** with mock or real data  
✅ **Full feature set** available for testing  

You now have a complete, working frontend that you can commit to your repo!
