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
- **Predictable:** Replies look and feel just like ChatGPT’s web app.

## 4. User Journey (End-to-End)

### Stage 1 — Awareness
User hears about Email2ChatGPT through:
- A coworker saying “Just email this address and it replies like ChatGPT.”
- A simple landing page describing: Email → ChatGPT → Reply.
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
- Reply email is generated within seconds.
- Subject is preserved.
- Tone matches ChatGPT defaults unless user instructs otherwise.

**Result:** “This just works.”

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
They reply “continue” and it behaves like ChatGPT.

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

**Inbound**
Postmark → Cloudflare Worker → D1 + R2 → OpenAI REST → Postmark outbound

**Components**

| Component | Purpose |
|-----------|---------|
| **Postmark** | Email ingress + egress |
| **Cloudflare Workers** | Main logic + routing |
| **D1** | Conversation metadata + message history |
| **R2** | Attachments storage |
| **OpenAI GPT-5.1** | Chat + attachments (via Files API + Responses API) |

## 6. Core Features (MVP)

1.  **Email → AI Reply**
    - Single turn and multi-turn.

2.  **Attachments**
    - Supports: PDFs, Word files, Images, Excel, Audio (optional), HTML
    - Each attachment is uploaded to R2 for storage.
    - Attachments are uploaded to OpenAI Files API and referenced in the Responses API call.
    - Inline images are preserved in text context; non-inline attachments are listed for AI visibility.

3.  **Thread Persistence**
    - Message-ID and In-Reply-To preserved
    - Full conversation reconstructed for the model
    - Users can treat the email chain as a chat window

4.  **Safety & Abuse Controls**
    - Block automated scammers
    - Basic prompt sanitation
    - Rate limits per sender
    - Attachment size limits

5.  **Reply Formatting**
    - Messages come back clean, ChatGPT-style.

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
npx wrangler d1 migrations apply rally-database --remote
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
cd services/mailer && npx wrangler deploy
cd ../ai && npx wrangler deploy
cd ../attachments && npx wrangler deploy
cd ../ingest && npx wrangler deploy
```

### 7. Configure Postmark webhook
See [POSTMARK_SETUP.md](./POSTMARK_SETUP.md) for detailed Postmark configuration.

## Architecture Details

| Component | Purpose |
|-----------|---------|
| **Ingest Service** | Main entry point. Handles webhooks, dashboard, D1 storage, and orchestration. Webhook: `/postmark/inbound` |
| **AI Service** | Dedicated worker for OpenAI GPT-5.1 via native REST API. Supports file attachments via OpenAI Files API + Responses API. **Note:** Uses `v1/responses` endpoint exclusively. |
| **Mailer Service** | Dedicated worker for sending emails via Postmark. |
| **Attachments Service** | Handles file uploads to Cloudflare R2. |
| **Cloudflare D1** | Stores messages, participants, and metadata. |
| **Cloudflare R2** | Stores email attachments. |
| **Postmark** | Inbound + outbound email handling. |
| **Cloudflare Access** | Protects admin dashboard; bypasses webhook path. |

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

## License

MIT License - feel free to use Email2ChatGPT for personal or commercial projects.

---

**Credits**
Built with Cloudflare Workers, D1, Postmark, and OpenAI GPT-5.1.
Produced by Rally Collaboration.
