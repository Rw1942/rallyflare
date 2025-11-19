# Email2ChatGPT – Product Documentation & User Journey

**Produced by Rally Collaboration**

## 1. Product Summary

Email2ChatGPT turns any email into a ChatGPT conversation. Users send an email to `chat@email2chatgpt.com`, and the service replies with AI-generated responses powered by GPT-5.1. No app. No login. No dashboard. Just email in, AI out.

It’s built for people and companies stuck behind firewalls, legacy environments, or restrictive IT policies. It works everywhere email works.

**Core idea:** AI that meets you where you already are: your inbox.

## 2. Primary Use Cases

### A. Individuals
- Quick AI help without opening a browser
- Write drafts, summarize threads, brainstorm
- Mobile-first users traveling or offline

### B. Corporate Employees (the real target)
- Banks, hospitals, insurers with locked-down devices
- Teams that can’t install extensions or use AI web apps
- Workers who can only access AI via email

### C. Process Automation
- Forward an entire thread for summarization
- Email attachments → processed, summarized, rewritten
- Email as a lightweight API surface

## 3. Key Product Principles

- **Zero UI:** The inbox is the interface.
- **Stateless conversations:** Each email thread becomes its own chat.
- **Secure by default:** Each email thread is siloed by Message-ID.
- **Attachment-friendly:** PDFs, images, docs processed automatically.
- **Predictable:** Replies powered by GPT-5.1, same intelligence as ChatGPT.
- **Rich Formatting:** Replies include bold, italics, lists, and code blocks rendered as clean HTML.

## 4. User Journey (End-to-End)

### Stage 1 — Awareness
User hears about Email2ChatGPT through:
- A coworker saying "Just email this address and it replies using GPT-5.1."
- A simple landing page describing: Email → GPT-5.1 → Reply.
- A social post showcasing the flow.

**Pain point at this stage:** “I’m on a locked-down system. I can’t use normal AI tools.”

They try it within seconds.

### Stage 2 — First Contact
**User Action:**
They send an email to `chat@email2chatgpt.com`.

Examples:
- “Rewrite the attached doc.”
- “Summarize this email chain.”
- “How do I explain compounding to my mom?”
- “Answer the questions below.”

**System Flow:**
1. Postmark receives inbound email
2. Cloudflare Worker parses: From, Subject, Body, Attachments
3. Worker writes metadata to D1
4. Worker pushes attachments to R2
5. Worker calls GPT-5.1 with:
   - Full email text (with flattened HTML for context)
   - All attachments uploaded via OpenAI Files API
   - Conversation thread history keyed off In-Reply-To

**System Response:**
- Reply email is generated within seconds
- Subject is preserved with "Re:" prefix
- Both plain text and HTML versions sent
- **Footer transparency**: Shows processing time breakdown and AI cost
- Tone matches GPT-5.1 defaults unless configured otherwise

**Result:** "This just works."

### Stage 3 — Returning User Experience
User realizes:
- They can forward any email into the system
- They can CC the system to get real-time summaries
- Attachments are handled automatically
- They can keep the thread going just by replying

Now the product becomes sticky.

**Typical patterns:**
- Inbox automation
- Thread rewriting
- Meeting summaries
- Policy interpretation
- Data extraction

### Stage 4 — Power User Behavior
Power users naturally discover more:

**A. Thread Summarization**
They forward a giant chain with: “Summarize this entire thread in a table.”

**B. Conversational Replies**
They reply "continue" and it behaves like GPT-5.1.

**C. Attachment-Based Workflows**
- PDFs → summarized
- Images → analyzed
- Spreadsheets → interpreted
- Docs → rewritten

**D. Multi-turn Chat via Email**
A long back-and-forth between user and AI inside the same thread.

### Stage 5 — Enterprise Adoption
Where the product becomes strategic:
- CIO loves this because it doesn’t require whitelisting web domains
- Employees use it without installing software
- Auditors love email logging
- IT doesn’t have to secure a new endpoint

**Future enterprise features (not needed on day one):**
- Allow-listed domains
- Billing per tenant
- Private model endpoints
- Encryption at rest for R2 and D1
- Tenant-scoped API keys

## 5. Product Architecture Overview

**Microservices Architecture**

Rally uses a microservices pattern with 4 independent Cloudflare Workers:

| Service | Purpose | Size |
|---------|---------|------|
| **rally-ingest** | Main coordinator: webhooks, dashboard, email formatting | ~73 KB |
| **rally-ai** | OpenAI API calls, file uploads | ~7 KB |
| **rally-mailer** | Postmark email sending | ~2 KB |
| **rally-attachments** | R2 file storage | ~1.5 KB |

**Flow:**
```
Postmark → Ingest Worker → AI Worker → Ingest → Mailer Worker → Postmark
                ↓
            D1 Database
                ↓
         Attachments Worker → R2
```

**Data Storage:**

| Component | Purpose |
|-----------|---------|
| **Cloudflare D1** | Messages, participants, settings, metrics |
| **Cloudflare R2** | Email attachments (backup copy) |
| **OpenAI Files API** | Attachments for AI analysis |

## 6. Core Features (MVP)

1.  **Email → AI Reply**
    - Single turn and multi-turn conversations
    - Thread history maintained via In-Reply-To headers
    - Up to 6 previous messages included for context

2.  **Attachments & Images**
    - Supports: PDFs, Word files, Images, Excel, all standard formats
    - **Dual storage**: R2 for backup, OpenAI Files API for AI analysis
    - **Smart filtering**: Images < 5KB ignored (tracking pixels, signatures)
    - **Inline images**: Converted to `[Image: description]` text markers + uploaded for AI
    - **Regular attachments**: Listed in text + uploaded to OpenAI in parallel

3.  **Thread Persistence**
    - Message-ID and In-Reply-To headers preserved
    - Recursive thread lookup (up to 6 messages)
    - Users can reply indefinitely in the same thread

4.  **Processing Transparency**
    - **Email footer** shows timing breakdown and cost for every reply
    - Tracks: Ingest time, R2 uploads, OpenAI uploads, AI processing, Mailer time
    - Displays OpenAI token usage and calculated cost
    - User-friendly descriptions (no technical jargon)

5.  **Reply Formatting**
    - **Auto-detection**: Intelligently detects plain text, markdown, or HTML
    - **Smart conversion**: Converts markdown to email-safe HTML with inline styles
    - **No dependencies**: Custom regex-based parser (no external libraries)
    - **Graceful degradation**: Falls back to plain text if format unclear
    - **Footer**: Table-based HTML for maximum email client compatibility
    - Works perfectly in Gmail, Outlook, Apple Mail, mobile clients

---

# Developer Guide & Setup

## Quick Start

### 1. Install dependencies
```bash
npm install
```

### 2. Create D1 database
```bash
npx wrangler d1 create rally-database
```

### 3. Create R2 bucket
```bash
npx wrangler r2 bucket create rally-attachments
```

### 4. Run migrations
```bash
# Migrations must be applied manually since we use microservices
# Check migrations/ folder for new .sql files and apply them:
npx wrangler d1 execute rally-database --remote --command "YOUR SQL HERE"
```

### 5. Set secrets
```bash
# Mailer needs Postmark token
cd services/mailer && npx wrangler secret put POSTMARK_TOKEN
# AI needs OpenAI key
cd ../../services/ai && npx wrangler secret put OPENAI_API_KEY
```

### 6. Deploy Services
```bash
# Deploy all services (order doesn't matter but dependencies first is good practice)
npx wrangler deploy services/mailer/src/index.ts --name rally-mailer
npx wrangler deploy services/attachments/src/index.ts --name rally-attachments
npx wrangler deploy services/ai/src/index.ts --name rally-ai
npx wrangler deploy services/ingest/src/index.ts --name rally-ingest
```

### 7. Configure Postmark webhook
See [POSTMARK_SETUP.md](./POSTMARK_SETUP.md) for detailed Postmark configuration.

## Architecture Details

### Service Responsibilities

**rally-ingest** (Main Coordinator)
- Receives Postmark webhooks at `/postmark/inbound`
- Parses email headers, body, attachments
- Stores messages in D1 database
- Coordinates with other services (AI, Mailer, Attachments)
- **Intelligent formatting**: Auto-detects and converts plain text/markdown/HTML
- Generates email footer with processing metrics and cost
- Serves admin dashboard with activity views

**rally-ai** (OpenAI Integration)
- Uploads attachments to OpenAI Files API in parallel
- Calls OpenAI Responses API (`/v1/responses`) exclusively
- Returns plain text responses (GPT-5.1 output)
- Tracks token usage and timing
- No formatting or HTML (single responsibility: talk to OpenAI)

**rally-mailer** (Email Sending)
- Sends emails via Postmark API
- Handles In-Reply-To and References headers
- Tracks send time

**rally-attachments** (File Storage)
- Stores attachments in R2 bucket
- Returns storage keys and file size
- Tracks upload time

### Database Schema

**Key tables:**
- `messages` - All inbound/outbound emails with metrics
- `attachments` - File metadata with R2 keys
- `project_settings` - AI model config and cost settings
- `email_prompts` - Email-specific AI prompts
- `users` - Contact tracking and compliance

**Performance columns:**
- `processing_time_ms` - Total end-to-end time
- `ingest_time_ms` - Parsing and coordination
- `attachment_time_ms` - R2 upload time
- `ai_response_time_ms` - OpenAI API response time
- `mailer_time_ms` - Email send time
- `tokens_input` / `tokens_output` - For cost calculation

## Admin Dashboard

Email2ChatGPT includes a beautiful, modern dashboard accessible at the root URL of your deployed Worker. It's designed to feel calm and uncluttered.

**Features:**
- **Activity View**: Statistics overview, incoming/outgoing messages, performance badges.
- **Settings Page**: Configure default AI system prompt.
- **Email Prompts Page**: Manage AI behavior for specific email addresses.
- **Users Page**: View all contacts, compliance indicators, and message counts.

## Development

Run locally with Wrangler:

```bash
npx wrangler dev
```

View logs:

```bash
npx wrangler tail
```

## Troubleshooting & Notes

### GPT-5.1 API Configuration

Rally uses **OpenAI Responses API** (`/v1/responses`) exclusively:
- **Model**: `gpt-5.1` or `gpt-5.1-mini`
- **Parameters**: `reasoning.effort`, `text.verbosity`, `max_output_tokens`
- **NOT using**: Chat Completions API (`/v1/chat/completions`)

Configure in Settings page:
- Reasoning effort: minimal, low, medium, high
- Text verbosity: low, medium, high
- Cost per 1M tokens (auto-populated based on model selection)

### Email Formatting

Rally intelligently handles GPT-5.1 responses in any format:

**Auto-detection logic:**
1. Scans for HTML tags (`<div>`, `<p>`) → uses as-is
2. Scans for markdown patterns (`#`, `**`, `-`, `` ` ``) → converts to HTML
3. Falls back to plain text → wraps with preserved formatting

**Markdown support:**
- Headers, bold, italic, code blocks, inline code
- Links, bullet lists, numbered lists
- All converted to inline-styled HTML for email compatibility

**No external libraries:** Custom regex-based parser (~100 lines) in `utils/emailFormatter.ts`

## License

MIT License - feel free to use Email2ChatGPT for personal or commercial projects.

---

**Credits**
Built with Cloudflare Workers, D1, Postmark, and OpenAI GPT-5.1.
Produced by Rally Collaboration.
