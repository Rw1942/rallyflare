# Message Table Display Specification

## Quick Reference: What Shows Where

### Context 1: All Messages (`/messages`)
**Query:** `SELECT * FROM messages ORDER BY received_at DESC`

```
┌─────────────────────────────────────────────────────────────┐
│ All Messages                                                 │
├─────────────────────────────────────────────────────────────┤
│ [Inbound] Meeting tomorrow?                    Jan 20, 3:45PM│
│ From: user@example.com → To: chat@email2chatgpt.com         │
│ Preview: Hey, can we meet tomorrow at 3pm to discuss...     │
├─────────────────────────────────────────────────────────────┤
│ [Outbound] Re: Meeting tomorrow?               Jan 20, 3:46PM│
│ From: chat@email2chatgpt.com → To: user@example.com         │
│ Preview: I'd be happy to help coordinate that meeting...    │
└─────────────────────────────────────────────────────────────┘
```

**Columns Shown:**
- Direction badge (Inbound/Outbound)
- Subject
- From → To
- Preview
- Timestamp

---

### Context 2: User History (`/users/:email`)
**Query:** `SELECT * FROM messages WHERE lower(recipient_email) = ? ORDER BY received_at DESC`

```
┌─────────────────────────────────────────────────────────────┐
│ User: rick.wills@gmail.com                                   │
│ Message History (247 messages)                               │
├─────────────────────────────────────────────────────────────┤
│ [Inbound] Meeting tomorrow?                    Jan 20, 3:45PM│
│ Via: chat@email2chatgpt.com                                  │
│ Preview: Hey, can we meet tomorrow at 3pm to discuss...     │
├─────────────────────────────────────────────────────────────┤
│ [Outbound] Re: Meeting tomorrow?               Jan 20, 3:46PM│
│ Via: chat@email2chatgpt.com                                  │
│ Preview: I'd be happy to help coordinate that meeting...    │
├─────────────────────────────────────────────────────────────┤
│ [Inbound] Analyze this report                  Jan 19, 2:15PM│
│ Via: documents@email2chatgpt.com                             │
│ Preview: Please review the attached Q4 financial report...  │
└─────────────────────────────────────────────────────────────┘
```

**Columns Shown:**
- Direction badge
- Subject
- Via: [persona email]
- Preview
- Timestamp

**Note:** From/To are implied (user is the recipient_email for all messages)

---

### Context 3: Persona History (`/personas/:email`)
**Query:** `SELECT * FROM messages WHERE lower(email_address) = ? ORDER BY received_at DESC`

```
┌─────────────────────────────────────────────────────────────┐
│ Persona: documents@email2chatgpt.com                         │
│ Message History (89 messages)                                │
├─────────────────────────────────────────────────────────────┤
│ [Inbound] Analyze this report                  Jan 19, 2:15PM│
│ From: rick.wills@gmail.com                                   │
│ Preview: Please review the attached Q4 financial report...  │
├─────────────────────────────────────────────────────────────┤
│ [Outbound] Re: Analyze this report             Jan 19, 2:16PM│
│ To: rick.wills@gmail.com                                     │
│ Preview: I've reviewed the Q4 report. Key findings include..│
├─────────────────────────────────────────────────────────────┤
│ [Inbound] Summarize whitepaper                 Jan 18, 9:30AM│
│ From: jane@company.com                                       │
│ Preview: Can you extract the main points from this PDF...   │
└─────────────────────────────────────────────────────────────┘
```

**Columns Shown:**
- Direction badge
- Subject
- From/To (single line, changes by direction)
- Preview
- Timestamp

**Note:** Persona is implied (it's the email_address for all messages)

---

## Data Model: Message Row

```typescript
interface MessageRow {
  // Core identification
  id: string;
  direction: 'inbound' | 'outbound';
  
  // Participants
  from_name: string;
  from_email: string;
  recipient_email: string;    // User involved (normalized to lowercase)
  email_address: string;       // Rally persona address (normalized to lowercase)
  
  // Content
  subject: string;
  raw_text?: string;
  raw_html?: string;
  llm_summary?: string;
  llm_reply?: string;
  
  // Metadata
  received_at: string;         // ISO timestamp
  sent_at?: string;            // ISO timestamp (for outbound)
  message_id?: string;
  in_reply_to?: string;
}
```

---

## Display Rules

### 1. Direction Badge
```typescript
if (direction === 'inbound') {
  badge = '<span class="badge badge-inbound">Inbound</span>';  // Green
} else {
  badge = '<span class="badge badge-outbound">Outbound</span>'; // Blue
}
```

### 2. From/To Fields (All Messages Context)
```typescript
if (direction === 'inbound') {
  from = `${from_name} <${from_email}>`;
  to = email_address;  // Rally persona
} else {
  from = email_address;  // Rally persona
  to = recipient_email;  // User who received reply
}
```

### 3. Persona Field (User History Context)
```typescript
// Always show which Rally persona handled this message
persona = email_address;  // e.g., "chat@email2chatgpt.com"
```

### 4. User Field (Persona History Context)
```typescript
if (direction === 'inbound') {
  user = `${from_name} <${from_email}>`;
} else {
  user = recipient_email;
}
```

### 5. Preview Text
```typescript
if (raw_text && raw_text.length > 0) {
  preview = raw_text.substring(0, 120).replace(/\s+/g, ' ').trim();
  if (raw_text.length > 120) preview += '...';
} else if (raw_html) {
  preview = 'Click to view HTML content';
} else {
  preview = 'No content';
}
```

### 6. Expanded Content
```typescript
if (raw_html) {
  content = raw_html;  // Render as-is in iframe or sanitized div
} else if (raw_text) {
  content = `<pre>${escapeHtml(raw_text)}</pre>`;
} else {
  content = '<p class="text-muted">No content available</p>';
}
```

---

## Component API Proposal

```typescript
interface MessageTableOptions {
  context: 'all' | 'user' | 'persona';
  messages: MessageRow[];
  pagination?: {
    page: number;
    totalPages: number;
    baseUrl: string;
  };
  emptyMessage?: string;
}

/**
 * Renders a message table with context-appropriate columns
 */
export function renderMessageTable(options: MessageTableOptions): string {
  const { context, messages, pagination, emptyMessage } = options;
  
  if (messages.length === 0) {
    return renderEmptyState(emptyMessage || getDefaultEmptyMessage(context));
  }
  
  const rows = messages.map(msg => {
    switch (context) {
      case 'all':
        return renderMessageRowFull(msg);
      case 'user':
        return renderMessageRowUser(msg);
      case 'persona':
        return renderMessageRowPersona(msg);
    }
  });
  
  return `
    <div class="message-list">
      ${rows.join('')}
    </div>
    ${pagination ? renderPagination(pagination) : ''}
  `;
}
```

---

## Current Bugs to Fix

### Bug 1: Wrong "To" Field Logic
**Location:** `services/ingest/src/dashboard/views/shared.ts:28`

```typescript
// CURRENT (WRONG)
const toEmail = isInbound ? (msg.email_address || 'Unknown') : (msg.recipient_email || 'Unknown');

// SHOULD BE
const toEmail = isInbound 
  ? (msg.email_address || 'rally@email2chatgpt.com')  // Inbound goes TO Rally
  : (msg.recipient_email || 'Unknown');                // Outbound goes TO user
```

### Bug 2: Missing Persona History Route
**Location:** `services/ingest/src/index.ts`

```typescript
// ADD THIS ROUTE
if (path.startsWith("/personas/") && path !== "/personas/new" && method === "GET") {
  const email = decodeURIComponent(path.split("/")[2]).toLowerCase();
  
  // Check if this is the edit form (has /edit suffix) or detail view
  if (path.endsWith("/edit")) {
    // Existing edit form logic
  } else {
    // NEW: Persona detail with message history
    const persona = await env.DB.prepare("SELECT * FROM email_settings WHERE email_address = ?").bind(email).first();
    if (!persona) return new Response("Persona not found", { status: 404 });
    
    const { results: history } = await env.DB.prepare(
      "SELECT * FROM messages WHERE lower(email_address) = ? ORDER BY received_at DESC LIMIT ? OFFSET ?"
    ).bind(email, limit, offset).all();
    
    return html(renderPersonaDetail(persona, safeResults(history), pagination));
  }
}
```

### Bug 3: No Message Count in Personas List
**Location:** `services/ingest/src/index.ts:121`

```typescript
// CURRENT
const { results } = await env.DB.prepare("SELECT * FROM email_settings ORDER BY email_address ASC").all();

// SHOULD BE
const { results } = await env.DB.prepare(`
  SELECT 
    es.*, 
    (SELECT COUNT(*) FROM messages WHERE lower(email_address) = es.email_address) as message_count
  FROM email_settings es 
  ORDER BY es.email_address ASC
`).all();
```

---

## Testing Checklist

- [ ] All messages view shows both inbound and outbound correctly
- [ ] User history shows all messages for case-insensitive email (Rick.Wills@gmail.com = rick.wills@gmail.com)
- [ ] Persona history shows all messages to/from that persona
- [ ] Empty states display helpful messages
- [ ] Expanding a message shows full content
- [ ] Pagination works in all three contexts
- [ ] No "Unknown" fields appear (except for truly missing data)
- [ ] From/To fields are semantically correct
- [ ] Performance is good with 1000+ messages

