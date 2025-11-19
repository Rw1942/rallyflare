# Email2ChatGPT Dashboard Guide

## User Story

**As an Email2ChatGPT admin,**  
I want to see a clean, peaceful dashboard of all email activity  
So that I can quickly understand what Email2ChatGPT is handling and ensure everything is working smoothly.

### Design Philosophy

The Email2ChatGPT dashboard embodies these principles:

- **Calm and Uncluttered** - Like reading a well-organized inbox, not a technical admin panel
- **Instantly Scannable** - Clear visual hierarchy with color-coded sections
- **Soft and Inviting** - Gentle gradients, rounded corners, and soft shadows
- **Trustworthy** - Shows Email2ChatGPT working invisibly in the background

## Features

### Dashboard Sections

1. **Statistics Overview**
   - Total Messages processed
   - Incoming emails received
   - Outgoing replies sent
   - AI-processed message count

2. **Incoming Messages**
   - All emails received by Email2ChatGPT
   - Shows sender name, email, subject, and time
   - AI-generated summary preview
   - Badges for:
     - Attachments
     - AI Processing status
     - Reply status

3. **Outgoing Replies**
   - All automated replies sent by Email2ChatGPT
   - Shows what Email2ChatGPT sent and when
   - Links back to original messages
   - Preview of AI-generated content

### Message Cards

Each message card displays:
- Sender's name and email address
- Time received (human-readable: "5m ago", "2h ago", "3d ago")
- Subject line
- AI-generated summary or reply preview (first 2 lines)
- Visual badges indicating message status

### Navigation

The dashboard includes a navigation bar with:
- **Activity** (current view)
- **Settings** (coming soon) - Configure general Email2ChatGPT behavior
- **AI Prompts** (coming soon) - Customize AI system prompts and models

## Design Details

### Color Scheme

- **Primary Gradient**: Purple-to-indigo (#667eea to #764ba2)
- **Background**: Soft gray gradient (#f5f7fa to #e8ecf1)
- **Cards**: Clean white with subtle shadows
- **Text**: Professional gray tones (#2d3748, #718096)

### Typography

- System fonts for native feel: -apple-system, SF Pro, Segoe UI, Roboto
- Clear hierarchy: Large headers, readable body text
- Weights: 400 (regular), 500 (medium), 600 (semi-bold), 700 (bold)

### Interactions

- **Hover Effects**: Cards lift slightly with enhanced shadow
- **Click**: Cards are clickable to view full message details
- **Responsive**: Works on desktop, tablet, and mobile

### Badges

Status indicators with custom colors:
- **Attachment** - Warm yellow background
- **AI Processed** - Cool cyan background  
- **Replied** - Fresh green background

## Database Schema Updates

To support the new dashboard, the following fields were added to the `messages` table:

```sql
ALTER TABLE messages ADD COLUMN direction TEXT CHECK(direction IN ('inbound', 'outbound')) DEFAULT 'inbound';
ALTER TABLE messages ADD COLUMN sent_at TEXT;
ALTER TABLE messages ADD COLUMN reply_to_message_id TEXT;
```

### Direction Field

- `'inbound'` - Messages received by Email2ChatGPT
- `'outbound'` - Replies sent by Email2ChatGPT

This allows the dashboard to cleanly separate incoming vs outgoing messages.

## Running the Migration

To apply the database changes:

```bash
npx wrangler d1 migrations apply rally-database --local  # For local testing
npx wrangler d1 migrations apply rally-database --remote # For production
```

## Implementation Notes

### Architecture

- **Single-page HTML** - No external JavaScript frameworks
- **Server-rendered** - HTML generated in Cloudflare Worker
- **Pure CSS** - No CSS frameworks, custom styling for performance
- **Responsive Design** - Mobile-first with breakpoints

### Performance

- Queries limited to 50 most recent messages
- Indexed by `received_at` for fast sorting
- Minimal DOM - cards render efficiently
- Inline styles for zero HTTP requests

## Future Enhancements

Planned features for upcoming releases:

1. **Settings Page**
   - Configure email addresses
   - Set processing rules
   - Manage integrations

2. **AI Prompts Configuration**
   - Edit system prompts
   - Choose AI models
   - Adjust temperature and parameters
   - Test prompts with sample emails

3. **Search & Filters**
   - Search messages by sender, subject, content
   - Filter by date range
   - Filter by AI processing status

4. **Message Detail View**
   - Full email content
   - Complete AI analysis
   - Participant list
   - Attachment viewing
   - Manual re-process button

5. **Analytics**
   - Response time metrics
   - Email volume over time
   - AI token usage
   - Popular topics/keywords

## Technical Stack

- **Cloudflare Workers** - Edge computing for instant response
- **Cloudflare D1** - SQLite database at the edge
- **Postmark** - Reliable email sending and receiving
- **OpenAI** - AI processing and response generation
- **TypeScript** - Type-safe development
