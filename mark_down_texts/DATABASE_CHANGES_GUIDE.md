# FacilityLink: Core Functionality Database Migrations

This guide contains the necessary SQL scripts to implement core functionality updates. Run these commands in your Supabase SQL Editor.

---

## 1. Add Status Tracking to Requests

This adds a `status` column to the `requests` table to enable an approval workflow. Stock will only be deducted when a request is marked as 'approved'.

```sql
-- Add a 'status' column to the requests table
ALTER TABLE public.requests
ADD COLUMN status TEXT NOT NULL DEFAULT 'pending'
CHECK (status IN ('pending', 'approved', 'rejected'));

-- Add an index for faster filtering by status
CREATE INDEX IF NOT EXISTS idx_requests_status ON public.requests(status);

-- COMMENT: Add a comment to the column for clarity in the Supabase UI
COMMENT ON COLUMN public.requests.status IS 'The current state of the request (pending, approved, rejected).';
```

---

## 2. Create Inventory History Table for SSMI Reports

This table will store monthly snapshots of inventory activity, which is essential for generating accurate "Summary of Supplies and Materials Issued" (SSMI) reports. It captures the beginning-of-month stock (`stock_on_hand`).

```sql
-- Create the table to store historical monthly data
CREATE TABLE IF NOT EXISTS public.inventory_history (
    pkid UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    item_no TEXT NOT NULL REFERENCES public.inventory(item_no) ON DELETE CASCADE,
    period_label TEXT NOT NULL, -- Eg: "November 1 to 30, 2024"
    item_description TEXT,
    stock_on_hand INTEGER NOT NULL, -- Beginning of month stock
    week1 INTEGER DEFAULT 0,
    week2 INTEGER DEFAULT 0,
    week3 INTEGER DEFAULT 0,
    week4 INTEGER DEFAULT 0,
    total_qty_issued INTEGER DEFAULT 0,
    unit_cost NUMERIC,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE (item_no, period_label)
);

-- Add comments for clarity
COMMENT ON TABLE public.inventory_history IS 'Stores monthly snapshots of inventory for historical reporting (SSMI).';
COMMENT ON COLUMN public.inventory_history.stock_on_hand IS 'Stock count at the beginning of the period (Day 1).';
COMMENT ON COLUMN public.inventory_history.period_label IS 'Unique label for the reporting period, e.g., "November 1 to 30, 2024".';
```

---

## 3. Create `add_stock` Function for Deleting Approved Requests

This database function is called from the Inbox page. When an admin deletes a request that was already 'approved', this function safely adds the item quantity back to the inventory's `remaining_stock`.

```sql
-- Creates a reusable function to add stock back to an inventory item.
CREATE OR REPLACE FUNCTION add_stock(item_id TEXT, quantity INT)
RETURNS void AS $$
BEGIN
  UPDATE public.inventory
  SET remaining_stock = remaining_stock + quantity
  WHERE item_no = item_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION public.add_stock(TEXT, INT) IS 'Restores a given quantity to an inventory item''s remaining_stock. Used when deleting an approved request.';
```

---

## 4. Migrating Existing `inventory_history` Data (Optional)

**Important:** This section is only for users who have an older version of the `inventory_history` table and wish to preserve its data. If you have already dropped the old table and created the new one from Section 2, you can skip this section.

If you have an existing `inventory_history` table with data from a previous version, you must migrate it to the new structure. The following steps will do this safely without data loss.

**Step 1: Rename your existing table to create a backup.**
```sql
-- This preserves your old data in case anything goes wrong.
ALTER TABLE public.inventory_history RENAME TO inventory_history_old;
```

**Step 2: Create the new `inventory_history` table.**
Run the script from **Section 2** of this guide to create the new, correctly structured table.

**Step 3: Copy data from the old table to the new one.**
This script moves your data and fetches the `item_description` from your main `inventory` table.
```sql
-- Migrate data from the backup to the new table
INSERT INTO public.inventory_history (
    item_no, period_label, item_description, stock_on_hand,
    week1, week2, week3, week4, total_qty_issued, unit_cost, created_at
)
SELECT
    old.item_no,
    old.period_label,
    inv.description, -- Fetches the current description from the inventory table
    COALESCE(old.stock_on_hand, 0),
    COALESCE(old.week1, 0), COALESCE(old.week2, 0), COALESCE(old.week3, 0), COALESCE(old.week4, 0),
    COALESCE(old.total_qty_issued, 0),
    old.unit_cost,
    old.snapshot_date -- Uses the old snapshot_date as the creation timestamp
FROM public.inventory_history_old AS old
LEFT JOIN public.inventory AS inv ON old.item_no = inv.item_no
WHERE old.item_no IS NOT NULL AND old.period_label IS NOT NULL;
```

**Step 4: (Optional) Drop the backup table.**
Once you have verified that your data has been migrated correctly, you can safely remove the old backup table.
```sql
-- Run this only after you've confirmed the new table has the correct data.
DROP TABLE public.inventory_history_old;
```
```
