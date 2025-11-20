# User Stories: Message Display & History Tables

## Problem Statement

The message display system is fragmented and inconsistent across different views. The current `renderMessageRow` function in `shared.ts` has issues:

1. **Data Model Confusion**: After the email normalization migration, the logic for determining "From" and "To" is incorrect
2. **No Persona History**: Personas don't have message history views yet
3. **Inconsistent Display**: Different contexts (all messages, user history, persona history) need different data but use the same rigid component
4. **Query Fragmentation**: Each view queries messages differently, leading to inconsistencies

## Core Principle

**One unified message table component that adapts to context**, backed by **consistent database queries** using the normalized `recipient_email` column.

---

## Epic 1: Fix Data Model & Queries

### User Story 1.1: Normalize Message Queries
**As a developer**, I want all message queries to use the unified `recipient_email` column, so that user and persona history is consistent and complete.

**Acceptance Criteria:**
- ✅ All inbound messages have `recipient_email = from_email` (user who sent)
- ✅ All outbound messages have `recipient_email = <user email>` (user who received)
- ✅ Queries for "user's messages" use `WHERE lower(recipient_email) = ?`
- ✅ Queries for "persona's messages" use `WHERE lower(email_address) = ?`
- [ ] Database query returns consistent field structure for all views

**Technical Notes:**
```typescript
// Standard fields returned by all message queries:
interface MessageRow {
  id: string;
  subject: string;
  direction: 'inbound' | 'outbound';
  from_name: string;
  from_email: string;
  recipient_email: string;  // The user involved in the conversation
  email_address: string;     // The Rally persona address
  received_at: string;
  sent_at?: string;
  raw_text?: string;
  raw_html?: string;
  llm_summary?: string;
  llm_reply?: string;
}
```

---

### User Story 1.2: Fix Message Row Display Logic
**As a user viewing message history**, I want to see accurate "From" and "To" fields based on message direction, so I understand the conversation flow.

**Acceptance Criteria:**
- [ ] Inbound messages show: From = `from_email`, To = `email_address` (Rally persona)
- [ ] Outbound messages show: From = `email_address` (Rally persona), To = `recipient_email`
- [ ] Display uses actual names when available (e.g., `from_name` for inbound)
- [ ] "Unknown" fallbacks are eliminated

**Current Bug:**
```typescript
// WRONG (current code in shared.ts line 28)
const toEmail = isInbound ? (msg.email_address || 'Unknown') : (msg.recipient_email || 'Unknown');

// CORRECT
const toEmail = isInbound 
  ? (msg.email_address || 'Rally') 
  : (msg.recipient_email || 'Unknown Recipient');
```

---

## Epic 2: Unified Message Table Component

### User Story 2.1: Create Flexible Message Table Component
**As a developer**, I want a single reusable message table component that adapts to different contexts (all messages, user history, persona history), so the UI is consistent and maintainable.

**Acceptance Criteria:**
- [ ] Component accepts `context` parameter: `'all' | 'user' | 'persona'`
- [ ] Component shows/hides columns based on context:
  - All messages: Show From, To, Subject, Date, Direction
  - User history: Show Persona, Subject, Date, Direction (From/To implied)
  - Persona history: Show User, Subject, Date, Direction (From/To implied)
- [ ] Component supports expandable rows for full message content
- [ ] Component handles empty states gracefully
- [ ] Component includes pagination controls

**API:**
```typescript
interface MessageTableOptions {
  context: 'all' | 'user' | 'persona';
  messages: MessageRow[];
  pagination?: { page: number, totalPages: number, baseUrl: string };
  emptyMessage?: string;
}

export function renderMessageTable(options: MessageTableOptions): string;
```

---

### User Story 2.2: Simplify Message Row Rendering
**As a user**, I want message previews to be scannable and clear, so I can quickly find the conversation I'm looking for.

**Acceptance Criteria:**
- [ ] Each row shows: Badge (Inbound/Outbound), Subject, Participants, Date, Preview
- [ ] Preview text is first 120 chars of `raw_text` or "View HTML content"
- [ ] Clicking row expands full message content (HTML if available, else text)
- [ ] Expanded content has clean styling with proper word wrap
- [ ] Direction badge has distinct colors (green = inbound, blue = outbound)

**Visual Hierarchy:**
```
[Badge] Subject                                    [Date]
From: Name <email>
To: Name <email>
Preview: First 120 characters of message text...

[Expanded Content - shows on click]
```

---

## Epic 3: Persona Message History

### User Story 3.1: Add Persona Detail View
**As an admin**, I want to view a persona's email address details page, so I can see message history and settings for that persona.

**Acceptance Criteria:**
- [ ] Route `/personas/:email` shows persona detail page
- [ ] Page displays persona settings (model, prompt, etc.)
- [ ] Page shows message history for this persona (all directions)
- [ ] Message history uses unified message table component with `context: 'persona'`
- [ ] Edit button links to existing edit form

**Query:**
```sql
-- Get all messages for a specific persona
SELECT * FROM messages 
WHERE lower(email_address) = ? 
ORDER BY received_at DESC 
LIMIT ? OFFSET ?
```

---

### User Story 3.2: Link Personas to Message History
**As an admin viewing the personas list**, I want to click a persona to see its message history, so I can audit how it's being used.

**Acceptance Criteria:**
- [ ] Personas list shows message count per persona
- [ ] Clicking a persona row navigates to `/personas/:email` (detail view)
- [ ] Edit action is separate button/link from the main row click

**Query for Count:**
```sql
-- Add message count to personas list
SELECT 
  es.*, 
  (SELECT COUNT(*) FROM messages WHERE lower(email_address) = es.email_address) as message_count
FROM email_settings es
ORDER BY es.email_address ASC
```

---

## Epic 4: Performance & Polish

### User Story 4.1: Optimize Queries for Large Datasets
**As a developer**, I want message queries to be efficient even with thousands of messages, so the dashboard remains fast.

**Acceptance Criteria:**
- [ ] Indexes exist on: `recipient_email`, `email_address`, `received_at`, `direction`
- [ ] Queries use `LIMIT` and `OFFSET` for pagination
- [ ] Count queries are separate from data queries
- [ ] No `SELECT *` in production queries (select only needed columns)

**Optimized Query Example:**
```sql
-- Instead of SELECT *
SELECT 
  id, subject, direction, from_name, from_email, 
  recipient_email, email_address, received_at, sent_at
FROM messages 
WHERE lower(recipient_email) = ? 
ORDER BY received_at DESC 
LIMIT ? OFFSET ?
```

---

### User Story 4.2: Add Empty State Messages
**As a user**, I want helpful messages when there's no data, so I know the system is working correctly.

**Acceptance Criteria:**
- [ ] All messages view: "No messages yet. Send an email to get started."
- [ ] User history: "No message history for this user yet."
- [ ] Persona history: "This persona hasn't received any emails yet."
- [ ] Empty states include relevant actions (e.g., "Send test email")

---

### User Story 4.3: Improve Date Display
**As a user**, I want to see relative dates (e.g., "2 hours ago") for recent messages and absolute dates for older ones, so I can quickly gauge recency.

**Acceptance Criteria:**
- [ ] Messages < 24 hours: "X hours ago" or "X minutes ago"
- [ ] Messages 1-7 days: "X days ago"
- [ ] Messages > 7 days: "Jan 15, 2025 at 3:45 PM"
- [ ] Hover shows full ISO timestamp
- [ ] Timezone is consistent (use user's local time or configurable default)

---

## Epic 5: Testing & Verification

### User Story 5.1: Manual Test Cases
**As a QA tester**, I want clear test scenarios to verify message display works correctly.

**Test Cases:**
1. **All Messages View**
   - [ ] Navigate to `/messages`
   - [ ] Verify both inbound and outbound messages appear
   - [ ] Verify From/To fields are accurate
   - [ ] Click a message, verify content expands
   - [ ] Test pagination works

2. **User History View**
   - [ ] Navigate to `/users/:email`
   - [ ] Verify user's inbound AND outbound messages appear
   - [ ] Verify message count matches pagination count
   - [ ] Test with user who has mixed case email (e.g., `Rick.Wills@gmail.com`)

3. **Persona History View**
   - [ ] Navigate to `/personas/:email`
   - [ ] Verify all messages to/from this persona appear
   - [ ] Verify correct direction badges
   - [ ] Test with newly created persona (should show empty state)

4. **Edge Cases**
   - [ ] User with no messages (empty state)
   - [ ] Persona with no messages (empty state)
   - [ ] Message with no subject (shows "(No Subject)")
   - [ ] Message with no text content (shows "No content")
   - [ ] Very long subject line (truncates gracefully)

---

## Implementation Priority

**Phase 1: Critical Fixes (Do First)**
1. ✅ Fix User Story 1.1 - Normalize queries (DONE - migration 0024)
2. Fix User Story 1.2 - Fix From/To display logic
3. Fix User Story 2.2 - Clean up message row rendering

**Phase 2: Persona Support (Do Next)**
4. Implement User Story 3.1 - Persona detail view
5. Implement User Story 3.2 - Link personas to history

**Phase 3: Polish (Do Last)**
6. Implement User Story 2.1 - Unified component API
7. Implement User Story 4.1 - Query optimization
8. Implement User Story 4.2 - Empty states
9. Implement User Story 4.3 - Better date display

---

## Success Metrics

- [ ] Zero "Unknown" fields in message display
- [ ] User history shows complete conversation (inbound + outbound)
- [ ] Persona history shows all messages for that persona
- [ ] No duplicate code across views (single shared component)
- [ ] Page load time < 500ms for 50 messages
- [ ] All manual test cases pass

---

## Technical Debt to Address

1. **Remove escapeHtml from personas.ts and users.ts** - Already exists in utils/index.ts
2. **Consolidate badge styles** - Define once in layout.ts CSS
3. **Add TypeScript interfaces** - Define MessageRow, MessageTableOptions types in types.ts
4. **Extract inline styles** - Move to layout.ts stylesheet for consistency
5. **Add error boundaries** - Catch and display DB errors gracefully

