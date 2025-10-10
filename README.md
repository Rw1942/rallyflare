# Rally - Email-Native AI Assistant

Rally is an invisible, email-native AI assistant built on Cloudflare Workers. Users interact with Rally entirely through email—no login, no app, just intelligent replies powered by OpenAI's GPT-5.

## Overview

Rally receives emails via Postmark, processes them with GPT-5 (including full conversation thread history), and sends contextual replies—all within the same email thread. Everything is logged and searchable in Cloudflare D1 with detailed performance metrics.

**Key Features:**
- 📧 Receive emails via Postmark inbound webhooks
- 🗄️ Store messages, participants, and metadata in Cloudflare D1
- 🤖 **Process with GPT-5** using OpenAI's Responses API (low reasoning, fast)
- 🧵 **Thread-aware** - tracks up to 5 previous messages in conversation history
- 📤 Send automated replies via Postmark with proper email threading
- 🎨 **Beautiful admin dashboard** with modern, soft design
- 📊 **Performance metrics** - processing time, AI response time, token usage
- ✉️ **Email-specific AI prompts** - different AI behavior per email address
- 🔍 Full RESTful API for message management
- ⚡ Edge-deployed for instant response times

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Create D1 database
npx wrangler d1 create rally-database
# Update database_id in wrangler.json with the returned ID

# 3. Run migrations
npx wrangler d1 migrations apply rally-database --remote

# 4. Set secrets
npx wrangler secret put POSTMARK_TOKEN
npx wrangler secret put OPENAI_API_KEY

# 5. Deploy
npx wrangler deploy

# 6. Configure Postmark webhook to point to:
# https://your-worker.workers.dev/postmark/inbound
```

See [POSTMARK_SETUP.md](./POSTMARK_SETUP.md) for detailed Postmark configuration.

## Why Rally?

Rally is designed to be **invisible** - your users never log in, never see a UI, never install anything. They just email your Rally address and get intelligent, contextual responses.

**Key Benefits:**
- ⚡ **Instant responses** - Edge-deployed on Cloudflare for <100ms latency
- 🧵 **Context-aware** - Remembers conversation history (up to 5 messages)
- 🎯 **Purpose-specific** - Different AI personalities per email address
- 📊 **Observable** - Track performance metrics for every message
- 🔧 **Easy to customize** - Web UI to update prompts, no code deploys needed
- 💰 **Cost-effective** - Serverless, pay-per-use, no idle costs
- 🛡️ **Secure** - Runs on Cloudflare's edge network, secrets managed by Wrangler

**Use Cases:**
- Customer support triage and initial responses
- Sales lead qualification and scheduling
- Feedback collection and acknowledgment
- Internal team communication automation
- Documentation Q&A bot via email
- Event RSVP processing and confirmations

## Architecture

| Component | Purpose |
|-----------|---------|
| **Cloudflare Worker** | Handles webhooks, OpenAI calls, and Postmark integration |
| **Cloudflare D1** | Stores messages, participants, attachments, and settings |
| **Cloudflare R2** | (Future) Storage for large attachments |
| **Postmark** | Inbound + outbound email handling |
| **OpenAI GPT-5** | LLM processing via Responses API with optimized reasoning effort |

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
# For production (remote)
npx wrangler d1 migrations apply rally-database --remote

# For local development
npx wrangler d1 migrations apply rally-database --local
```

**Important:** The database name in wrangler.json is `rally-database` (with hyphen, not underscore).

This creates tables for:

**`messages`** - Core email storage
- Message content, subject, sender/recipient info
- AI processing results (`llm_summary`, `llm_reply`)
- Direction tracking (`inbound`/`outbound`)
- Thread tracking (`in_reply_to`, `references_header`, `reply_to_message_id`)
- Performance metrics (`processing_time_ms`, `ai_response_time_ms`, `tokens_input`, `tokens_output`)
- Recipient email address for prompt lookup

**`participants`** - Email recipients (To/Cc/Bcc)

**`attachments`** - Attachment metadata (R2 storage coming soon)

**`project_settings`** - Default AI configuration
- Model selection (currently GPT-5)
- Default system prompt
- Temperature (deprecated for GPT-5, which uses reasoning effort)

**`email_prompts`** - Email-specific AI behavior
- Email address → custom system prompt mapping
- Allows different AI personalities per Rally inbox

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

## Deployment Workflow

### Standard Deployment Process

When making changes to Rally, follow this workflow:

1. **Check current status:**
   ```bash
   git status
   ```

2. **Stage your changes:**
   ```bash
   git add .
   ```

3. **Commit with descriptive message:**
   ```bash
   git commit -m "Brief description of changes

   - Detailed bullet points of what changed
   - Include any new features or fixes
   - Mention database changes if applicable"
   ```

4. **Push to repository:**
   ```bash
   git push origin main
   ```

5. **Apply database migrations (if any):**
   ```bash
   npx wrangler d1 migrations apply rally-database --remote
   ```

6. **Deploy Worker:**
   ```bash
   npx wrangler deploy
   ```

### Database Migration Best Practices

- **Always run migrations before deploying** the Worker code
- **Test migrations locally first:** `npx wrangler d1 migrations apply rally-database --local`
- **Use descriptive migration names:** `0006_add_email_specific_prompts.sql`
- **Include rollback information** in migration comments if needed
- **Check migration status:** `npx wrangler d1 migrations list rally-database --remote`

### Git Best Practices

- **Write clear commit messages** that explain what and why
- **Use bullet points** for multiple changes in one commit
- **Keep commits focused** - one feature or fix per commit
- **Test locally** before committing
- **Push frequently** to avoid losing work

### Deployment Checklist

Before deploying to production:

- [ ] All changes committed and pushed to git
- [ ] Database migrations applied to remote database
- [ ] Secrets are set: `npx wrangler secret list`
- [ ] Local testing completed
- [ ] Worker deploys successfully: `npx wrangler deploy`
- [ ] Test the deployment by sending an email to your Rally address
- [ ] Check logs: `npx wrangler tail`

### 7. Configure Postmark Webhook

See [POSTMARK_SETUP.md](./POSTMARK_SETUP.md) for detailed instructions.

**Quick steps:**
1. Log into Postmark dashboard
2. Go to Servers → Your Server → Settings → Inbound
3. Set webhook URL to: `https://your-worker-url.workers.dev/postmark/inbound`
4. Configure your inbound email address or domain

## Admin Dashboard

Rally includes a beautiful, modern dashboard accessible at the root URL of your deployed Worker. It's designed to feel calm and uncluttered, like a well-organized inbox rather than a technical admin panel.

### Dashboard Features

**Activity View** (`/`)
- Statistics overview cards (total, received, sent, AI-processed)
- Separate sections for incoming and outgoing messages
- Message cards showing sender, subject, time, and AI summary
- Visual badges: attachments, AI processing, reply status
- **Performance badges**: processing time, AI response time, token usage
- Click any message to view full details (coming soon)

**Settings Page** (`/settings`)
- Configure default AI system prompt for Rally
- Model info: GPT-5 with low reasoning effort & low verbosity
- Live preview of current prompt
- One-click save with success feedback

**Email Prompts Page** (`/email-prompts`)
- Manage AI behavior for specific email addresses
- Add/Edit/Delete email-specific prompts
- Visual cards showing email → prompt mapping
- Override default behavior per Rally inbox

**Design**: Soft gradients, rounded corners, smooth hover effects, responsive for all devices. See [DASHBOARD_GUIDE.md](./DASHBOARD_GUIDE.md) for full design philosophy.

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `GET /` | GET | Admin dashboard (HTML) |
| `POST /postmark/inbound` | POST | Receives Postmark webhook payloads |
| `GET /messages` | GET | List all messages (JSON) |
| `GET /messages/:id` | GET | Get message detail with participants |
| `GET /settings` | GET | Settings page (HTML) |
| `POST /settings` | POST | Update Rally's default system prompt |
| `GET /email-prompts` | GET | Email prompts management page (HTML) |
| `POST /email-prompts` | POST | Create new email-specific prompt |
| `PUT /email-prompts/:id` | PUT | Update email-specific prompt |
| `DELETE /email-prompts/:id` | DELETE | Delete email-specific prompt |

## How It Works

1. **Email arrives** at your Rally address (e.g., `support@rallycollab.com`)
2. **Postmark forwards** it to your Worker at `/postmark/inbound`
3. **Worker stores** message data in D1, including the recipient email address
4. **Content extracted** from TextBody, StrippedTextReply, or HtmlBody (handles forwarded emails)
5. **Thread history retrieved** via recursive CTE - fetches up to 5 previous messages in the conversation
6. **Worker looks up** email-specific prompt for the recipient address (falls back to default)
7. **GPT-5 processes** the email with thread context and appropriate prompt
8. **Worker sends** an intelligent reply via Postmark (preserving email threads with proper headers)
9. **Performance metrics captured** - total processing time, AI response time, token usage
10. **Everything logged** in D1 for admin console with full debugging info

### Email Addressing

Rally uses a smart addressing strategy to maintain clean email threads:

- **From Address**: All outbound emails come from `rally@rallycollab.com` for consistent branding
- **Reply-To Address**: Set to the original Rally inbox the user contacted (e.g., `requests@rallycollab.com`)
- **Threading**: Proper `In-Reply-To` and `References` headers keep conversations organized

This means users see a consistent sender identity, but their replies route back to the correct Rally inbox.

### Thread-Aware Conversations

Rally maintains conversation context across multiple emails:

- **Recursive Tracking**: Uses SQL recursive CTE to traverse `in_reply_to` chains
- **History Limit**: Fetches up to 5 previous messages in the thread
- **Smart Context**: Includes both user messages and Rally's previous replies
- **Token Efficiency**: Long threads are truncated to 50,000 characters max
- **Chronological Order**: Messages sorted by `received_at` for coherent context

This means Rally remembers what was discussed earlier in the conversation, leading to more intelligent and contextual responses.

### Email-Specific AI Prompts

Rally supports different AI behavior for different email addresses:

- **Default Prompt**: Configured in Settings page, used as fallback for unknown addresses
- **Email-Specific Prompts**: Configured in Email Prompts page, override default for specific addresses
- **Automatic Detection**: Worker automatically detects recipient address and uses appropriate prompt
- **Example Use Cases**:
  - `support@rallycollab.com` - Customer support assistant with empathetic tone
  - `sales@rallycollab.com` - Sales assistant for lead qualification
  - `feedback@rallycollab.com` - Feedback collector with acknowledgment focus

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
# Query remote database
npx wrangler d1 execute rally-database --remote --command "SELECT * FROM messages LIMIT 5"

# Query local database
npx wrangler d1 execute rally-database --local --command "SELECT * FROM messages LIMIT 5"

# Check performance metrics
npx wrangler d1 execute rally-database --remote --command "SELECT subject, processing_time_ms, ai_response_time_ms, tokens_input, tokens_output FROM messages WHERE processing_time_ms IS NOT NULL ORDER BY received_at DESC LIMIT 10"
```

## Project Structure

```
rallyflare/
├── src/
│   ├── index.ts           # Main Worker - routes, webhook handling, AI processing
│   └── renderHtml.ts      # Dashboard, settings, and email prompts UI
├── migrations/
│   ├── 0001_create_comments_table.sql     # Original D1 template migration
│   ├── 0002_create_rally_tables.sql       # Core Rally schema
│   ├── 0003_add_message_direction.sql     # Inbound/outbound message tracking
│   ├── 0004_update_model_to_gpt4o.sql     # GPT-5 upgrade
│   ├── 0005_add_performance_metrics.sql   # Processing time & token tracking
│   └── 0006_add_email_specific_prompts.sql # Email-specific AI prompts
├── wrangler.json          # Worker configuration (DB binding, vars)
├── package.json           # Dependencies and scripts
├── tsconfig.json          # TypeScript configuration
├── .dev.vars              # Local development secrets (gitignored)
├── POSTMARK_SETUP.md      # Postmark webhook configuration guide
├── DASHBOARD_GUIDE.md     # Dashboard design philosophy
└── README.md              # This file
```

## Configuration

### Default AI Behavior

Customize Rally's default AI behavior through the Settings page at `/settings` or by directly editing the `project_settings` table in D1:

```sql
UPDATE project_settings 
SET system_prompt = 'You are Rally, a helpful assistant...'
WHERE project_slug = 'default';
```

### Email-Specific AI Behavior

Configure different AI behavior for specific email addresses through the Email Prompts page at `/email-prompts` or by directly editing the `email_prompts` table:

```sql
-- Add email-specific prompt
INSERT INTO email_prompts (email_address, system_prompt) 
VALUES ('support@rallycollab.com', 'You are Rally, a customer support assistant...');

-- Update existing prompt
UPDATE email_prompts 
SET system_prompt = 'Updated prompt...'
WHERE email_address = 'support@rallycollab.com';
```

### Model Configuration

Note: GPT-5 uses `reasoning.effort` and `text.verbosity` instead of temperature. These are configured in the Worker code:
- `reasoning.effort: "low"` - Fast responses suitable for email
- `text.verbosity: "low"` - Concise replies

The model is fixed to `gpt-5` and uses the OpenAI Responses API (`/v1/responses` endpoint).

## Roadmap

### ✅ Completed
- Email receiving via Postmark inbound webhooks
- GPT-5 integration with Responses API
- Thread-aware conversation tracking (up to 5 messages)
- Admin dashboard with incoming/outgoing views
- Performance metrics tracking (time, tokens)
- Email-specific AI prompts
- Settings management UI
- HTML email handling and forwarding support

### 🚧 In Progress
- Cloudflare Access authentication for admin dashboard
- Message detail view with full content
- Manual re-process/re-send functionality

### 🔮 Future Plans
- R2 attachment storage and viewing
- Multi-tenant project support (multiple Rally instances)
- Replace Postmark with Cloudflare Email Workers
- Cost tracking dashboard (based on token usage)
- Search and filtering by sender/subject/date
- Analytics dashboard (response times, volume, topics)
- Email templates for common responses
- Scheduled digest emails

## Troubleshooting

**Emails not being received?**
- Check Postmark Activity log
- Verify webhook URL in Postmark settings
- Run `npx wrangler tail` to see incoming requests

**Getting "No response generated" from AI?**
- Check logs with `npx wrangler tail` to see the full OpenAI response structure
- Verify email content was extracted (check for "Processing email - Length: X")
- For forwarded emails, confirm HTML extraction is working (look for "Has HTML fallback: true")
- The worker now logs detailed request/response info for debugging

**Forwarded email threads not processing?**
- Worker extracts content from HTML when TextBody is empty
- Handles HTML-only forwarded emails by stripping HTML tags
- Truncates extremely long threads to 50,000 characters
- Thread history tracked via recursive CTE (up to 5 previous messages)

**OpenAI errors?**
- Verify `OPENAI_API_KEY` is set: `npx wrangler secret list`
- Check your OpenAI API quota/billing
- GPT-5 requires access to the Responses API (`/v1/responses` endpoint)

**Can't send replies?**
- Verify `POSTMARK_TOKEN` is set
- Check sender domain is verified in Postmark
- Ensure outbound message stream is enabled

**Email-specific prompts not working?**
- Check that the email address in `email_prompts` table matches exactly (case-sensitive)
- Verify the email address is being captured correctly in the `messages.email_address` field
- Check Worker logs to see which prompt is being used: `npx wrangler tail`
- Ensure the migration was applied: `npx wrangler d1 migrations apply rally-database --remote`

**Deployment issues?**
- **Migration failed:** Check if tables already exist, use `INSERT OR IGNORE` for sample data
- **Worker won't deploy:** Verify all TypeScript compiles: `npx tsc --noEmit`
- **Database connection errors:** Ensure D1 database ID is correct in `wrangler.json`
- **Secrets missing:** Set required secrets: `npx wrangler secret put POSTMARK_TOKEN`
- **Git conflicts:** Resolve conflicts before deploying: `git status` and `git pull origin main`

## Performance & Scalability

Rally is built on Cloudflare's edge platform, which means:

- **Global Distribution**: Worker runs in 300+ cities worldwide
- **Low Latency**: Typical response time <100ms for webhook processing
- **Auto-Scaling**: Handles sudden traffic spikes automatically
- **High Availability**: 99.99% uptime SLA from Cloudflare
- **Cost Efficiency**: 100K requests/day on free tier, then $0.50 per million

**Typical Processing Times:**
- Webhook receipt → D1 storage: ~10-20ms
- OpenAI API call (GPT-5, low reasoning): ~500-1500ms
- Reply send via Postmark: ~100-200ms
- **Total end-to-end**: ~1-2 seconds from email receipt to reply sent

## Contributing

Rally is an active project and contributions are welcome! Areas where help would be appreciated:

- 🐛 Bug fixes and issue reports
- 📚 Documentation improvements
- ✨ New feature implementations (see Roadmap)
- 🧪 Test coverage
- 🎨 Dashboard UI enhancements

Feel free to open issues or submit PRs on GitHub.

## License

MIT License - feel free to use Rally for personal or commercial projects.

---

## Credits

Built with:
- [Cloudflare Workers](https://workers.cloudflare.com/) - Serverless execution
- [Cloudflare D1](https://developers.cloudflare.com/d1/) - SQLite at the edge
- [Postmark](https://postmarkapp.com/) - Reliable email infrastructure
- [OpenAI GPT-5](https://openai.com/) - AI language model

This project was initially bootstrapped from the [Cloudflare D1 Template](https://github.com/cloudflare/templates/tree/main/d1-template) and evolved into a full-featured email AI assistant.
