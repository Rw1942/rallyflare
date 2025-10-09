# Rally - Email-Native AI Assistant

Rally is an invisible, email-native AI assistant built on Cloudflare Workers. Users interact with Rally entirely through email—no login, no app, just intelligent replies powered by OpenAI.

## Overview

Rally receives emails via Postmark, processes them with OpenAI, and sends contextual replies—all within the same email thread. Everything is logged and searchable in Cloudflare D1.

**Key Features:**
- Receive emails via Postmark inbound webhooks
- Store messages, participants, and metadata in D1
- Process email content with OpenAI for intelligent responses
- Send automated replies via Postmark API (preserving email threads)
- **Beautiful admin dashboard** with modern, soft design
- Separate views for incoming messages and outgoing replies
- Real-time statistics and AI processing status
- RESTful API for message management

## Architecture

| Component | Purpose |
|-----------|---------|
| **Cloudflare Worker** | Handles webhooks, OpenAI calls, and Postmark integration |
| **Cloudflare D1** | Stores messages, participants, attachments, and settings |
| **Cloudflare R2** | (Future) Storage for large attachments |
| **Postmark** | Inbound + outbound email handling |
| **OpenAI API** | LLM processing for intelligent replies |

## Setup Steps

### 1. Install Dependencies

```bash
npm install
```

### 2. Create D1 Database

Create the Rally database:

```bash
npx wrangler d1 create rally-database
```

Update the `database_id` in `wrangler.json` with the ID returned from the command above.

### 3. Run Database Migrations

Initialize the database with Rally's schema:

```bash
npx wrangler d1 migrations apply rally-database
```

This creates tables for:
- `messages` - Email messages and AI processing results
- `participants` - To/Cc/Bcc recipients
- `attachments` - Attachment metadata (R2 storage coming soon)
- `project_settings` - AI model configuration per project

### 4. Configure Secrets

Set your API keys as Worker secrets:

```bash
npx wrangler secret put POSTMARK_TOKEN
# Paste your Postmark server token

npx wrangler secret put OPENAI_API_KEY
# Paste your OpenAI API key
```

For local development, copy `.dev.vars.example` to `.dev.vars`:

```bash
# .dev.vars
POSTMARK_TOKEN=your-postmark-token
OPENAI_API_KEY=your-openai-key
```

### 5. Create R2 Bucket (Optional)

For attachment storage:

```bash
npx wrangler r2 bucket create rally-attachments
```

### 6. Deploy

Deploy the Worker to Cloudflare:

```bash
npx wrangler deploy
```

You'll get a URL like: `https://rallyflare.your-subdomain.workers.dev`

### 7. Configure Postmark Webhook

See [POSTMARK_SETUP.md](./POSTMARK_SETUP.md) for detailed instructions.

**Quick steps:**
1. Log into Postmark dashboard
2. Go to Servers → Your Server → Settings → Inbound
3. Set webhook URL to: `https://your-worker-url.workers.dev/postmark/inbound`
4. Configure your inbound email address or domain

## Admin Dashboard

Rally includes a beautiful, modern dashboard accessible at the root URL of your deployed Worker.

**Features:**
- Clean, soft design with gentle gradients and smooth interactions
- Statistics overview (total messages, received, sent, AI-processed)
- Separate sections for incoming and outgoing messages
- Each message card shows sender, subject, time, and AI summary
- Visual badges for attachments, AI processing, and reply status
- Click any message to view full details
- Responsive design for desktop, tablet, and mobile

See [DASHBOARD_GUIDE.md](./DASHBOARD_GUIDE.md) for complete design philosophy and user story.

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `GET /` | GET | Admin dashboard (HTML) |
| `POST /postmark/inbound` | POST | Receives Postmark webhook payloads |
| `GET /messages` | GET | List all messages (JSON) |
| `GET /messages/:id` | GET | Get message detail with participants |

## How It Works

1. **Email arrives** at your Rally address (e.g., `requests@rallycollab.com`)
2. **Postmark forwards** it to your Worker at `/postmark/inbound`
3. **Worker stores** message data in D1
4. **OpenAI processes** the email content using configured prompts
5. **Worker sends** an intelligent reply via Postmark API
6. **Everything logged** in D1 for admin console review

## Development

Run locally with Wrangler:

```bash
npx wrangler dev
```

This starts a local server with D1 bindings. Use a tool like [ngrok](https://ngrok.com/) to expose localhost for Postmark webhook testing.

View logs:

```bash
npx wrangler tail
```

Query D1 directly:

```bash
npx wrangler d1 execute rally-database --command "SELECT * FROM messages LIMIT 5"
```

## Project Structure

```
rallyflare/
├── src/
│   ├── index.ts           # Main Worker with webhook handling
│   └── renderHtml.ts      # Dashboard UI rendering
├── migrations/
│   ├── 0001_create_comments_table.sql  # Original template migration
│   ├── 0002_create_rally_tables.sql    # Rally schema
│   └── 0003_add_message_direction.sql  # Inbound/outbound tracking
├── wrangler.json          # Worker configuration
├── .dev.vars              # Local development secrets (gitignored)
├── POSTMARK_SETUP.md      # Detailed Postmark configuration guide
├── DASHBOARD_GUIDE.md     # Dashboard design and user story
└── README.md              # This file
```

## Configuration

Edit `project_settings` in D1 to customize AI behavior:

```sql
UPDATE project_settings 
SET model = 'gpt-4o', 
    system_prompt = 'You are Rally, a helpful assistant...',
    temperature = 0.3
WHERE project_slug = 'default';
```

## Next Steps

- [x] Build admin dashboard UI with modern design
- [x] Separate incoming and outgoing message views
- [ ] Add Settings page for configuration
- [ ] Add AI Prompts configuration page
- [ ] Add Cloudflare Access authentication
- [ ] Implement R2 attachment storage
- [ ] Add manual re-process/re-send functionality
- [ ] Create multi-tenant project support
- [ ] Replace Postmark with Cloudflare Email Workers

## Troubleshooting

**Emails not being received?**
- Check Postmark Activity log
- Verify webhook URL in Postmark settings
- Run `npx wrangler tail` to see incoming requests

**OpenAI errors?**
- Verify `OPENAI_API_KEY` is set: `npx wrangler secret list`
- Check your OpenAI API quota/billing

**Can't send replies?**
- Verify `POSTMARK_TOKEN` is set
- Check sender domain is verified in Postmark
- Ensure outbound message stream is enabled

## Contributing

This is a proof-of-concept for Rally. Contributions welcome!

## License

MIT

---

## Original Template

This project was bootstrapped from the Cloudflare D1 Template:
- **Template:** [cloudflare/templates/d1-template](https://github.com/cloudflare/templates/tree/main/d1-template)
- **Original Demo:** [https://d1-template.templates.workers.dev](https://d1-template.templates.workers.dev)

The original template demonstrated a simple Worker + D1 setup with a comments table. Rally extends this foundation with email processing, AI integration, and Postmark connectivity.

For the original template documentation and setup, see the [Cloudflare D1 Template](https://github.com/cloudflare/templates/tree/main/d1-template).
