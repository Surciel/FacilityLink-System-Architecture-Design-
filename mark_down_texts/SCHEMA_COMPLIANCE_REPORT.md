# FacilityLink Database Schema Compliance Report

**Date:** May 24, 2026  
**Status:** ⚠️ CRITICAL ISSUES FOUND - Schema Mismatch & Documentation Outdated

---

## Executive Summary

The project **does NOT follow the documented database schema**. The actual implementation uses a **different schema structure** than what is defined in `DATABASE_SCHEMA.md`. While the code queries are functioning correctly with the actual schema, there is a **significant disconnect** between documentation and implementation that poses risks for:

- Team collaboration and onboarding
- Database migrations
- Future maintenance
- API contract clarity

---

## Schema Architecture Comparison

### DOCUMENTED SCHEMA (DATABASE_SCHEMA.md) ❌

The documentation defines a normalized structure with separate tables:

```
inventory (id: UUID, name, category, current_stock, ...)
  ↓
requests (id: UUID, request_number, requester_info, status, ...)
  ↓
request_items (request_id → item_id, quantity) [JOIN TABLE]
  
stock_movements (tracking all stock changes)
```

**Issue:** This structure is NOT implemented in the actual codebase.

---

### ACTUAL SCHEMA (Being Used in Code) ✅

The implementation uses a denormalized structure based on the diagram provided:

```
requests (pkid: UUID, item_no, quantity_requested, request_group_id, ...)
  ↓
inventory (item_no: VARCHAR, description, remaining_stock, minimum_stock, ...)
  ↓
units (pkid: UUID, name)

Additional tables:
  - deliveries (item_no reference)
  - inventory_history (tracking by week/period)
```

**Difference:** Direct `item_no` relationship, no separate `request_items` join table.

---

## Detailed Schema Verification

### ✅ REQUESTS TABLE - PROPERLY IMPLEMENTED

**Current Usage:** Dashboard, InboxPage, AnalyticsPage, UserRequestPage

| Field | Type | Used | Status |
|-------|------|------|--------|
| `pkid` | UUID | ✅ All pages | ✓ Correct |
| `requested_by` | varchar | ✅ Dashboard, InboxPage | ✓ Correct |
| `department` | varchar | ✅ Dashboard, InboxPage, AnalyticsPage | ✓ Correct |
| `item_no` | varchar | ✅ Dashboard, UserRequestPage | ✓ Correct (links to inventory) |
| `quantity_requested` | int | ✅ Dashboard, InboxPage | ✓ Correct |
| `created_at` | timestamp | ✅ All pages (sorting) | ✓ Correct |
| `request_group_id` | varchar/uuid | ✅ InboxPage (grouping) | ✓ Correct |
| `requester_type` | varchar | ✅ InboxPage, UserRequestPage | ✓ Correct (student/faculty) |
| `requester_info` | varchar | ✅ InboxPage, UserRequestPage | ✓ Correct |

**Query Examples:**
```typescript
// Dashboard
.select("pkid, requested_by, department, item_no, quantity_requested, created_at, request_group_id")

// InboxPage
.select("pkid, requested_by, department, item_no, quantity_requested, created_at, request_group_id, requester_type, requester_info, inventory(...)")

// UserRequestPage (INSERT)
.insert({
  item_no, quantity_requested, requested_by, requester_type, requester_info,
  department, request_group_id, created_at
})
```

**Status:** ✅ FULLY COMPLIANT with actual schema

---

### ✅ INVENTORY TABLE - PROPERLY IMPLEMENTED

**Current Usage:** InventoryPage, Dashboard, InboxPage, AnalyticsPage, UserRequestPage

| Field | Type | Used | Status |
|-------|------|------|--------|
| `item_no` | varchar | ✅ All pages | ✓ Correct (primary identifier) |
| `description` | text | ✅ All pages | ✓ Correct |
| `unit_id` | UUID FK | ✅ InventoryPage, Dashboard | ✓ Correct (links to units) |
| `remaining_stock` | int | ✅ All pages | ✓ Correct |
| `minimum_stock` | int | ✅ InventoryPage | ✓ Correct |
| `units` (JOIN) | object | ✅ All pages | ✓ Correct (nested join) |

**Query Examples:**
```typescript
// InventoryPage - Full details
.select("item_no, description, unit_id, remaining_stock, minimum_stock, units!inner(pkid, name)")

// Dashboard - Compact
.select("item_no, description, unit_id, units(name)")

// UserRequestPage - Availability check
.select("item_no, description, unit_id, units(name), remaining_stock")
.ilike("item_no", `${facilityPrefix}%`)  // Filter by JMS or GYM-S prefix
```

**Status:** ✅ FULLY COMPLIANT with actual schema

---

### ✅ UNITS TABLE - PROPERLY IMPLEMENTED

**Current Usage:** InventoryPage, Dashboard

| Field | Type | Used | Status |
|-------|------|------|--------|
| `pkid` | UUID | ✅ InventoryPage | ✓ Correct |
| `name` | varchar | ✅ All pages (displayed) | ✓ Correct |

**Query Examples:**
```typescript
// Fetch all units
.from("units").select("pkid, name").order("name", { ascending: true })

// CRUD operations
.insert({ name: newUnitName })
.delete().eq("pkid", unitId)
```

**Status:** ✅ FULLY COMPLIANT with actual schema

---

### ⚠️ DELIVERIES TABLE - INCOMPLETE DOCUMENTATION

**Current Usage:** InventoryPage (deletion cascade)

**Defined Fields:** Unknown (only `item_no` reference visible in code)

**Query Examples:**
```typescript
// Cascade delete on item removal
.from("deliveries").delete().eq("item_no", itemId)

// Real-time subscription
.on("postgres_changes", { table: "deliveries" }, ...)
```

**Issues:**
- No schema definition provided
- Only item_no reference visible
- Unknown purpose and other fields
- Triggers stock updates via real-time subscription

**Recommendation:** 📋 Document the full `deliveries` table schema

---

### ⚠️ INVENTORY_HISTORY TABLE - INCOMPLETE DOCUMENTATION

**Current Usage:** AnalyticsPage (monthly trend calculations)

**Visible Fields:** period_label, quantity_used, [others unknown]

**Query Examples:**
```typescript
// Fetch usage data by period
.from("inventory_history").select("period_label, quantity_used")

// Filtered by item_no (from diagram schema)
```

**Issues:**
- Partially documented in schema diagram
- Purpose seems to be tracking historical stock movements by week
- Fields referenced in diagram but not queried: week1-4, stock_on_hand, delivery, total_qty_issued, unit_cost, total_cost, balance_on_hand, snapshot_date

**Recommendation:** 📋 Document the relationship and update frequency

---

### ❌ REQUEST_ITEMS TABLE - NOT IMPLEMENTED

**Documented in:** DATABASE_SCHEMA.md  
**Actually Used:** ❌ NEVER

**Issue:** The documentation defines a normalized join table, but the actual implementation stores `item_no` directly in the `requests` table.

**Impact:**
- Denormalization means one request row per item (not grouped)
- Grouping happens in application code via `request_group_id`
- Less efficient for querying all items in a request, but simpler implementation

---

### ❌ STOCK_MOVEMENTS TABLE - NOT IMPLEMENTED

**Documented in:** DATABASE_SCHEMA.md  
**Actually Used:** ❌ NEVER

**Issue:** Comprehensive audit trail table is defined but never used in code.

**Impact:**
- No automatic audit logging of stock changes
- Stock updates are direct (inventory.remaining_stock decrement)
- No historical record of why stock changed

**Recommendation:** 🔄 Either implement stock_movements logging or remove from documentation

---

## Field Naming Issues

| Documented | Actual | Severity |
|----------|--------|----------|
| `inventory.id` (UUID) | `inventory.item_no` (varchar) | 🔴 HIGH - Core difference |
| `inventory.current_stock` | `inventory.remaining_stock` | 🟡 MEDIUM - Different naming |
| `request.request_number` | Uses `request_group_id` for grouping | 🟡 MEDIUM - Different approach |
| `request_items` (table) | None (denormalized) | 🔴 HIGH - Architectural difference |
| `stock_movements` (table) | None (no audit trail) | 🟡 MEDIUM - Missing feature |

---

## Code Compliance Analysis

### ✅ Queries Following Actual Schema Correctly

**UserRequestPage (Insert)**
```typescript
const requestsToInsert = validatedItems.map((item) => ({
  item_no: item.id,                           // ✅ Correct
  quantity_requested: item.quantity,          // ✅ Correct
  requested_by: personalInfo.fullName,        // ✅ Correct
  requester_type: personalInfo.userType,      // ✅ Correct
  requester_info: personalInfo.facultyId,     // ✅ Correct
  department: department,                     // ✅ Correct
  request_group_id: requestGroupId,           // ✅ Correct
  created_at: phTime.toISOString(),          // ✅ Correct
}));
```

**InventoryPage (Select with JOIN)**
```typescript
.select("item_no, description, unit_id, remaining_stock, minimum_stock, units!inner(pkid, name)")
         // ✅ All fields exist | ✅ Correct JOIN syntax
```

**Dashboard (Query with nested JOIN)**
```typescript
.select("pkid, requested_by, department, item_no, quantity_requested, created_at, request_group_id")
// ✅ All fields correct
```

### ⚠️ Potential Issues

**1. Facility Prefix Filtering**
```typescript
.ilike("item_no", `${facilityPrefix}%`)  // JMS for faculty, GYM-S for students
```
- Depends on item_no naming convention being strictly enforced
- **Status:** Correctly implemented but relies on data integrity

**2. Facility Join Query in InboxPage**
```typescript
.select("..., inventory(description, unit_id, units(name))")
// This assumes a ONE-TO-ONE relationship between requests.item_no → inventory.item_no
// ✅ Correct for current denormalized schema
```

**3. Stock Update After Request**
```typescript
.update({ remaining_stock: item.currentStock - item.quantity })
.eq("item_no", item.id)
```
- Direct update with no transaction/audit
- **Status:** Works but no rollback on failure

---

## Risk Assessment

| Risk | Severity | Impact | Mitigation |
|------|----------|--------|-----------|
| Schema documentation outdated | 🔴 HIGH | Team confusion, migration errors | Update DATABASE_SCHEMA.md immediately |
| No audit trail (stock_movements unused) | 🟡 MEDIUM | Cannot track stock issues | Implement logging or acknowledge as limitation |
| Denormalized requests structure | 🟡 MEDIUM | Less efficient queries for multi-item requests | Acceptable given current scale, document design decision |
| Missing deliveries schema | 🟡 MEDIUM | Unclear table purpose | Document fully or remove if unused |
| No transaction handling | 🟡 MEDIUM | Partial failures possible | Implement transactions if critical |
| Facility prefix relies on data quality | 🟡 MEDIUM | Could break if item_no format inconsistent | Add database constraint or validation |

---

## Recommendations

### Immediate (This Week)

1. **Update DATABASE_SCHEMA.md** to document the actual schema, not the originally planned one
   - Rename section "Planned Schema" vs "Current Schema"
   - Document all five tables: requests, inventory, units, deliveries, inventory_history
   - Add the actual field lists and relationships

2. **Document Deliveries Table** fully
   - Purpose, fields, relationships
   - Why it triggers inventory updates

3. **Document Inventory_History Table** fully
   - How data is populated (by what process?)
   - Relationship to inventory.item_no
   - Weekly calculation logic

### Short-term (This Sprint)

4. **Add Database Constraints** to enforce data integrity
   - Check constraint on item_no format (JMS###[A-Z] or GYM-S-###[A-Z])
   - Foreign key from requests.item_no → inventory.item_no

5. **Create a Schema Diagram** in code documentation (ERD format)
   - Show actual relationships
   - Mark primary/foreign keys
   - Include data types

6. **Add Inline Comments** to Supabase queries explaining field mappings
   - Especially for joins with units table

### Medium-term (Next Sprint)

7. **Implement Transaction Handling** for request submission
   - Wrap insert + stock update in a transaction
   - Ensure atomic operations

8. **Decide on Audit Trail**
   - Keep stock_movements table documented but unused
   - OR implement full audit logging
   - OR acknowledge as limitation

9. **Add API Documentation** showing expected request/response structures based on actual schema

---

## Verification Checklist

- [x] All `requests` table queries use correct fields
- [x] All `inventory` table queries use correct fields  
- [x] `units` JOIN is properly implemented
- [x] `item_no` as primary identifier is consistent
- [x] Facility prefix filtering (JMS/GYM-S) works correctly
- [ ] `deliveries` table schema documented
- [ ] `inventory_history` table purpose clarified
- [ ] Database constraints enforced
- [ ] Transaction handling implemented
- [ ] Schema documentation updated

---

## Conclusion

**The project DOES properly follow the actual database schema implementation,** but the documentation is **severely outdated and misleading**. All code queries correctly reference the actual tables and fields. The main issue is **documentation vs. reality mismatch**, not query correctness.

**Priority:** Update all documentation to reflect the actual schema and architectural decisions to prevent future confusion and maintain code quality standards.

---

*End of Report*
