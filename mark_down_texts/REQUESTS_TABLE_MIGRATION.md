# Requests Table Migration Guide

## Overview

This guide provides steps to add support for capturing Student Number (for students) and Phone Number (for faculty) in the requests table.

## Current Status

✅ **Form Capture**: UserRequestPage already collects these details from users during request submission  
⏳ **Database Storage**: To enable this feature, you need to add columns to the `requests` table

---

## Migration Steps

### Step 1: Add New Columns to Requests Table

Run the following SQL in Supabase to add the three new columns:

```sql
-- Add columns to store user type and contact details
ALTER TABLE requests ADD COLUMN user_type TEXT CHECK (user_type IN ('student', 'faculty'));
ALTER TABLE requests ADD COLUMN student_number TEXT;
ALTER TABLE requests ADD COLUMN faculty_id TEXT;
```

**Explanation:**

- `user_type`: Stores whether the requester is a 'student' or 'faculty' member
- `student_number`: Stores the student's ID (e.g., "2024-12345")
- `faculty_id`: Stores the faculty member's phone number (e.g., "+63 555 123 4567")

### Step 2: Update Code Comments

Once the columns are created, uncomment the following lines in `UserRequestPage.tsx`:

In the `handleSubmitToSupabase` function around line 540, the code is currently commented out:

```typescript
// const requestsToInsert = validatedItems.map((item) => ({
//   ...
//   user_type: personalInfo.userType,
//   student_number: personalInfo.userType === "student" ? personalInfo.studentNumber : null,
//   faculty_id: personalInfo.userType === "faculty" ? personalInfo.facultyId : null,
//   ...
// }));
```

After creating the columns, uncomment this section to enable data capture and storage.

### Step 3: Update InboxPage Display

Once the columns exist and data is being stored, uncomment the display logic in `InboxPage.tsx`:

In the Request Details section (around line 520), the conditional display of Student Number and Phone Number can be uncommented to show these details when viewing requests.

---

## Testing the Migration

After completing the steps above:

1. **Test with a Student Request:**
   - Go to UserRequestPage
   - Select "Student" as user type
   - Enter a student number (e.g., "2024-12345")
   - Submit a request
   - Go to InboxPage and verify the student number appears in the request details

2. **Test with a Faculty Request:**
   - Go to UserRequestPage
   - Select "Faculty" as user type
   - Enter a phone number (e.g., "+63 555 123 4567")
   - Submit a request
   - Go to InboxPage and verify the phone number appears in the request details

---

## Accessing Supabase SQL Editor

1. Go to your Supabase project dashboard
2. Navigate to the **SQL Editor** (or **SQL**) section from the left sidebar
3. Create a new query
4. Copy and paste the SQL commands above
5. Execute the query
6. Verify the columns were created

---

## Rollback (If Needed)

If you need to remove these columns:

```sql
ALTER TABLE requests DROP COLUMN IF EXISTS user_type;
ALTER TABLE requests DROP COLUMN IF EXISTS student_number;
ALTER TABLE requests DROP COLUMN IF EXISTS faculty_id;
```

---

## Notes

- These columns are optional (can be NULL)
- The form validation still requires these fields to be filled before submission
- Student number format: XXXX-XXXXX (e.g., "2024-12345")
- Faculty phone format: +63 XXX XXX XXXX (e.g., "+63 555 123 4567")
