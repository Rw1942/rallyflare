# Rally - Email-Native AI Assistant

Rally is an invisible, email-native AI assistant built on Cloudflare Workers. Users interact with Rally entirely through email—no login, no app, just intelligent replies powered by OpenAI's GPT-5.1.

## Overview

Rally receives emails via Postmark, processes them with GPT-5.1 (including full conversation thread history), and sends contextual replies—all within the same email thread. Everything is logged and searchable in Cloudflare D1 with detailed performance metrics.

**Key Features:**
- Receive emails via Postmark inbound webhooks
- Store messages, participants, and metadata in Cloudflare D1
- **Process with GPT-5.1** using OpenAI's Responses API (adaptive reasoning)
- **File attachment support** - Send PDFs, images, and documents directly to GPT-5.1
- **Thread-aware** - tracks up to 5 previous messages in conversation history
- Send automated replies via Postmark with proper email threading
- **Beautiful admin dashboard** with modern, soft design
- **Performance metrics** - processing time, AI response time, token usage
- **Email-specific AI prompts** - different AI behavior per email address
- **User tracking & compliance** - GDPR-compliant contact management with consent tracking
- Full RESTful API for message management
- Edge-deployed for instant response times
- **Cloudflare Access protected** - Secure admin dashboard with bypass for webhooks

## Quick Start

# 1. Install dependencies
npm install

# 2. Create D1 database
npx wrangler d1 create rally-database

# 3. Create R2 bucket
npx wrangler r2 bucket create rally-attachments

# 4. Run migrations
npx wrangler d1 migrations apply rally-database --remote

# 5. Set secrets (for each service as needed)
# Mailer needs Postmark token
cd services/mailer && npx wrangler secret put POSTMARK_TOKEN
# AI needs OpenAI key
cd ../../services/ai && npx wrangler secret put OPENAI_API_KEY

# 6. Deploy Services (each service individually)
cd services/mailer && npx wrangler deploy
cd ../ai && npx wrangler deploy
cd ../attachments && npx wrangler deploy
cd ../ingest && npx wrangler deploy

# 7. Configure Cloudflare Access (see Security section below)

# 8. Configure Postmark webhook:
# https://Rick:123@rallyflare.your-subdomain.workers.dev/postmark/inbound
```

See [POSTMARK_SETUP.md](./POSTMARK_SETUP.md) for detailed Postmark configuration.

## Why Rally?

Rally is designed to be **invisible** - your users never log in, never see a UI, never install anything. They just email your Rally address and get intelligent, contextual responses.

**Key Benefits:**
- **Instant responses** - Edge-deployed on Cloudflare for <100ms latency
- **Context-aware** - Remembers conversation history (up to 5 messages)
- **Purpose-specific** - Different AI personalities per email address
- **Observable** - Track performance metrics for every message
- **Easy to customize** - Web UI to update prompts, no code deploys needed
- **Cost-effective** - Serverless, pay-per-use, no idle costs
- **Secure** - Runs on Cloudflare's edge network, secrets managed by Wrangler

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
| **Ingest Service** | Main entry point. Handles webhooks, dashboard, D1 storage, and orchestration. Webhook: `/postmark/inbound` |
| **AI Service** | Dedicated worker for OpenAI GPT-5.1 via native REST API. Supports file attachments via multipart/form-data. |
| **Mailer Service** | Dedicated worker for sending emails via Postmark. |
| **Attachments Service** | Handles file uploads to Cloudflare R2. |
| **Cloudflare D1** | Stores messages, participants, and metadata. |
| **Cloudflare R2** | Stores email attachments. |
| **Postmark** | Inbound + outbound email handling. |
| **Cloudflare Access** | Protects admin dashboard; bypasses webhook path. |

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
- Model selection (currently GPT-5.1)
- Default system prompt
- Reasoning Effort (controls adaptive thinking depth)

**`email_prompts`** - Email-specific AI behavior
- Email address → custom system prompt mapping
- Allows different AI personalities per Rally inbox

**`users`** - User tracking and compliance
- Email address, name, first/last seen timestamps
- Message counts (sent/received)
- Consent tracking (email, data processing)
- Opt-out status, IP address, user agent
- GDPR data subject rights tracking

**`user_interactions`** - Interaction audit trail
- Complete log of all user interactions
- Links to messages, includes IP and user agent
- Timestamped for compliance reporting

### 4. Cloudflare API Token Setup

To deploy your Worker and interact with Cloudflare services (D1, R2), you'll need a Cloudflare API Token. Set this as an environment variable:

```bash
# For PowerShell (Windows)
$env:CLOUDFLARE_API_TOKEN="<YOUR_CLOUDFLARE_API_TOKEN>"

# For Bash/Zsh (Linux/macOS)
export CLOUDFLARE_API_TOKEN="<YOUR_CLOUDFLARE_API_TOKEN>"
```

**Required API Token Permissions:**

When creating your API Token in the Cloudflare dashboard ([https://dash.cloudflare.com/profile/api-tokens](https://dash.cloudflare.com/profile/api-tokens)), ensure it has **ALL** of the following permissions. It's recommended to create a **new token** to guarantee all permissions are correctly applied:

-   **Account Permissions:**
    -   **Account Settings**: `Read`
    -   **Memberships**: `Read`
    -   **Worker Scripts**: `Edit`
    -   **Cloudflare D1**: `Edit`
    -   **Cloudflare R2**: `Edit`
    -   **Cloudflare Pages**: `Edit`

-   **Zone Permissions:**
    -   **Workers Routes**: `Edit`

-   **User Permissions:**
    -   **User Details**: `Read`

Replace `<YOUR_CLOUDFLARE_API_TOKEN>` with the actual token value.

### 5. Configure Secrets

Set your API keys as Worker secrets:

```bash
npx wrangler secret put POSTMARK_TOKEN
# Paste your Postmark server token

npx wrangler secret put OPENAI_API_KEY
# Paste your OpenAI API key
```

For local development, copy `.dev.vars.example` to `.dev.vars` (this file is gitignored):

```bash
# .dev.vars
POSTMARK_TOKEN=your-postmark-token
OPENAI_API_KEY=your-openai-key
```

### 6. Create R2 Bucket (Optional)

For attachment storage:

```bash
npx wrangler r2 bucket create rally-attachments
```

### 7. Deploy

Deploy each service individually. Services can be deployed in any order as they use Service Bindings.

```bash
# Navigate to project root
cd /path/to/rallyflare

# Deploy each service (order doesn't matter with Service Bindings)
cd services/mailer && npx wrangler deploy
cd ../ai && npx wrangler deploy
cd ../attachments && npx wrangler deploy
cd ../ingest && npx wrangler deploy
```

You'll get a URL like: `https://rallyflare.your-subdomain.workers.dev`

### 8. Configure Cloudflare Access (Security)

Rally uses Cloudflare Access to protect the admin dashboard while allowing Postmark webhooks through.

**Required Setup:**

1. **Create Bypass Application for Webhook Path**
   - Go to Cloudflare Dashboard → Zero Trust → Access → Applications
   - Click "Add an application" → "Self-hosted"
   - **Application Name:** "Postmark Webhook Bypass"
   - **Domain:** `rallyflare.your-subdomain.workers.dev`
   - **Path:** `/postmark/inbound`
   
2. **Add Bypass Policy**
   - **Policy Name:** "Bypass for Everyone"
   - **Action:** Bypass
   - **Rule type:** Include
   - **Selector:** Everyone

3. **Keep Main Application Protected**
   - Your main "Rally Admin Console" application should protect the root path
   - This keeps the dashboard secure while allowing webhooks

**Why this matters:** Without the Bypass policy, Postmark webhooks will be blocked by Cloudflare Access authentication, and emails won't process.

### 9. Configure Postmark Webhook

See [POSTMARK_SETUP.md](./POSTMARK_SETUP.md) for detailed instructions.

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
   # Run from project root
   npx wrangler d1 migrations apply rally-database --remote
   ```

6. **Deploy Services** (deploy only the services you changed):
   ```bash
   # If you changed the AI service:
   cd services/ai && npx wrangler deploy
   
   # If you changed the Ingest service:
   cd services/ingest && npx wrangler deploy
   
   # If you changed the Mailer service:
   cd services/mailer && npx wrangler deploy
   
   # If you changed the Attachments service:
   cd services/attachments && npx wrangler deploy
   ```

**Note:** All deployment commands must be run from the specific service directory, not the project root.

## Deployment Checklist

Before deploying to production:

- [X] Cloudflare API Token (`CLOUDFLARE_API_TOKEN`) is set with correct permissions.
- [ ] All changes committed and pushed to git
- [ ] Database migrations applied to remote database
- [ ] Secrets are set: `npx wrangler secret list`
- [ ] Local testing completed
- [ ] Worker deploys successfully: `npx wrangler deploy`
- [ ] Test the deployment by sending an email to your Rally address
- [ ] Check logs: `npx wrangler tail`

### 8. Configure Postmark Webhook

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

**Users Page** (`/users`)
- View all contacts who have interacted with Rally
- Statistics: total users, active users, opted-out users
- Compliance indicators: email consent, data processing consent
- Message counts per user (sent/received)
- First seen and last seen timestamps
- Opt-out status tracking

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
| `GET /users` | GET | Users & compliance management page (HTML) |
| `GET /users/:email` | GET | Get user detail with interaction history (JSON) |
| `GET /api/users` | GET | List all users (JSON) |
| `GET /status/postmark-inbound` | GET | Get the status of the Postmark inbound webhook (last received email timestamp) |

## How It Works

1. **Email arrives** at your Rally address (e.g., `support@rallycollab.com`)
2. **Postmark forwards** it to your Worker at `/postmark/inbound`
3. **Worker extracts** compliance data (IP address, user agent) from request headers
4. **User tracking** - Creates or updates user record with email, name, timestamps, consent data
5. **Worker stores** message data in D1, including the recipient email address
6. **Interaction logged** - Audit trail entry created in `user_interactions` table
7. **Content extracted** from TextBody, StrippedTextReply, or HtmlBody (handles forwarded emails)
8. **Thread history retrieved** via recursive CTE - fetches up to 5 previous messages in the conversation
9. **Worker looks up** email-specific prompt for the recipient address (falls back to default)
10. **GPT-5 processes** the email with thread context and appropriate prompt
11. **Worker sends** an intelligent reply via Postmark (preserving email threads with proper headers)
12. **Outbound interaction logged** - User record updated with received message count
13. **Performance metrics captured** - total processing time, AI response time, token usage
14. **Everything logged** in D1 for admin console with full debugging info

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

### User Tracking & Compliance

Rally automatically tracks all users who interact via email, with GDPR-compliant data collection:

- **Automatic User Creation**: New email addresses are captured on first interaction
- **Interaction Tracking**: Every inbound/outbound message updates user records
- **Compliance Data**: IP address, user agent, timestamps for GDPR requirements
- **Consent Management**: Tracks email consent and data processing consent (defaults to `true` for email senders)
- **Opt-Out Support**: Users can be marked as opted-out with timestamps
- **Data Subject Rights**: Fields for tracking export requests, deletion requests
- **Audit Trail**: Complete interaction history in `user_interactions` table
- **Privacy-First**: User tracking errors don't break email processing

**Admin Interface**: View all users at `/users` with statistics, consent indicators, and message counts.

### Email-Specific AI Prompts

Rally supports different AI behavior for different email addresses:

- **Default Prompt**: Configured in Settings page, used as fallback for unknown addresses
- **Email-Specific Prompts**: Configured in Email Prompts page, override default for specific addresses
- **Automatic Detection**: Worker automatically detects recipient address and uses appropriate prompt
- **Example Use Cases**:
  - `support@rallycollab.com` - Customer support assistant with empathetic tone
  - `sales@rallycollab.com` - Sales assistant for lead qualification
  - `feedback@rallycollab.com` - Feedback collector with acknowledgment focus

### Compliance & GDPR

Rally includes built-in features for GDPR compliance:

- **Lawful Basis**: Automatic consent tracking (legitimate interest for email senders)
- **Right to Access**: User detail endpoint shows all stored data
- **Right to Erasure**: Deletion request tracking (manual deletion process)
- **Right to Data Portability**: Export request tracking
- **Transparency**: Full interaction audit trail with timestamps
- **IP & User Agent**: Captured for security and fraud prevention
- **Opt-Out Mechanism**: Flag users who request to stop receiving emails

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
├── services/
│   ├── ingest/            # Main Worker - Orchestrator, Webhooks, Dashboard
│   │   ├── src/
│   │   └── wrangler.toml
│   ├── ai/                # AI Service - OpenAI integration
│   │   ├── src/
│   │   └── wrangler.toml
│   ├── mailer/            # Mailer Service - Postmark integration
│   │   ├── src/
│   │   └── wrangler.toml
│   └── attachments/       # Attachments Service - R2 uploads
│       ├── src/
│       └── wrangler.toml
├── shared/                # Shared types and utilities
├── migrations/            # D1 database migrations
├── package.json           # Root workspace configuration
├── tsconfig.json          # TypeScript configuration
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

The model is fixed to `gpt-5.1` and uses the OpenAI Responses API (`/v1/responses` endpoint).

## Roadmap

### ✅ Completed
- Email receiving via Postmark inbound webhooks
- GPT-5.1 integration with native REST API (Responses API)
- **File attachment support** - PDFs, images, documents sent to GPT-5.1 via multipart/form-data
- Thread-aware conversation tracking (up to 5 messages)
- Admin dashboard with incoming/outgoing views
- Performance metrics tracking (time, tokens)
- Email-specific AI prompts
- Settings management UI
- HTML email handling and forwarding support
- User tracking with GDPR compliance features
- Interaction audit trail
- Consent management (email, data processing)
- **Cloudflare Access integration** - Dashboard protected, webhook bypass configured
- R2 attachment storage and metadata tracking

### 🚧 In Progress
- Message detail view with full content
- Manual re-process/re-send functionality
- Attachment viewing in dashboard

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

**User tracking not capturing data?**
- Check Worker logs for user capture errors: `npx wrangler tail`
- Verify the migration was applied: `npx wrangler d1 migrations list rally-database --remote`
- Query users table directly: `npx wrangler d1 execute rally-database --remote --command "SELECT * FROM users LIMIT 5"`
- IP address may be null in local development (Cloudflare headers not present)

**Deployment issues?**
- **Cloudflare API Token missing/incorrect permissions:** Ensure `CLOUDFLARE_API_TOKEN` is set as an environment variable with all required permissions (see section 4 above).
- **Migration failed:** Check if tables already exist, use `INSERT OR IGNORE` for sample data
- **Worker won't deploy:** Verify all TypeScript compiles: `npx tsc --noEmit`
- **Database connection errors:** Ensure D1 database ID is correct in `wrangler.json`
- **Secrets missing:** Set required secrets: `npx wrangler secret put POSTMARK_TOKEN`
- **Git conflicts:** Resolve conflicts before deploying: `git status` and `git pull origin main`

### Common Wrangler & D1 Issues

If you're having trouble running `wrangler d1` commands, check these common issues:

-   **`wrangler.toml` vs `wrangler.json`:** This project uses the modern `wrangler.toml` configuration format. If you have an old `wrangler.json` file in your project, delete it to avoid conflicts.
-   **Wrong Database Name:** The D1 database for this project is named `rally-database`. Ensure you use this name in your commands (e.g., `npx wrangler d1 execute rally-database ...`).
-   **Local vs. Remote Database:** By default, `wrangler` commands run against a *local* development database. If you see an error like `no such table: messages`, it's because your local database is empty. To interact with your live, deployed database, you **must** add the `--remote` flag to your command.
    ```bash
    # This command targets your LIVE database in the cloud
    npx wrangler d1 execute rally-database --command "SELECT * FROM messages LIMIT 5;" --remote
    ```

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

- Bug fixes and issue reports
- Documentation improvements
- New feature implementations (see Roadmap)
- Test coverage
- Dashboard UI enhancements

Feel free to open issues or submit PRs on GitHub.

## License

MIT License - feel free to use Rally for personal or commercial projects.

---

## Credits

Built with:
- [Cloudflare Workers](https://workers.cloudflare.com/) - Serverless execution
- [Cloudflare D1](https://developers.cloudflare.com/d1/) - SQLite at the edge
- [Postmark](https://postmarkapp.com/) - Reliable email infrastructure
- [OpenAI GPT-5.1](https://openai.com/) - AI language model

This project was initially bootstrapped from the [Cloudflare D1 Template](https://github.com/cloudflare/templates/tree/main/d1-template) and evolved into a full-featured email AI assistant.
