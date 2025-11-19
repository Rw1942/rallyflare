# Postmark Webhook Setup Guide

## Overview

Rally receives inbound emails via Postmark webhooks. When someone sends an email to your Rally address (e.g., `chat@email2chatgpt.com`), Postmark will forward the email data to your Cloudflare Worker.

## Setup Steps

### 1. Deploy Your Worker

First, deploy your worker to get the public URL:

```bash
# Run migrations first
npx wrangler d1 migrations apply rally-database

# Deploy worker
npx wrangler deploy
```

You'll get a URL like: `https://rallyflare.your-subdomain.workers.dev`

### 2. Configure Postmark Inbound Stream

1. Log into your [Postmark account](https://account.postmarkapp.com/)
2. Go to **Servers** → Select your server → **Settings** → **Inbound**
3. Create a new **Inbound Stream** or edit existing one
4. Set the **Webhook URL** to:
   ```
   https://rallyflare.your-subdomain.workers.dev/postmark/inbound
   ```

### 3. Add Inbound Domain/Email Address

1. In the same Inbound settings, add your domain or set up a forwarding address
2. Common options:
   - **Option A**: Use a Postmark-provided address (e.g., `abc123@inbound.postmarkapp.com`)
   - **Option B**: Configure your own domain's MX records to point to Postmark
     - MX Priority 10: `inbound.postmarkapp.com`

### 4. Test the Integration

Send a test email to your configured address. You can verify it worked by:

1. Check your worker logs:
   ```bash
   npx wrangler tail
   ```

2. Query your D1 database:
   ```bash
   npx wrangler d1 execute rally-database --command "SELECT * FROM messages LIMIT 5"
   ```

3. Visit your worker URL to see recent messages:
   ```
   https://rallyflare.your-subdomain.workers.dev/
   ```

## Webhook Payload

Postmark sends a JSON payload to `/postmark/inbound` with this structure:

```json
{
  "FromName": "John Doe",
  "From": "john@example.com",
  "FromFull": {
    "Email": "john@example.com",
    "Name": "John Doe"
  },
  "To": "requests@rallycollab.com",
  "Subject": "Project Update",
  "TextBody": "Here's the update...",
  "HtmlBody": "<p>Here's the update...</p>",
  "MessageID": "abc123",
  "Date": "2025-10-09T12:00:00Z",
  "Attachments": []
}
```

## What Rally Does

When Rally receives the webhook:

1. **Stores** the email in D1 database
2. **Extracts** participants (To, Cc, etc.)
3. **Processes** the content with OpenAI
4. **Sends** an automated reply via Postmark
5. **Logs** everything for the admin console

## Troubleshooting

### Email not received?

- Check Postmark's Activity log in their dashboard
- Verify webhook URL is correct and ends with `/postmark/inbound`
- Check Worker logs: `npx wrangler tail`

### OpenAI not working?

- Verify `OPENAI_API_KEY` is set: `npx wrangler secret list`
- Check OpenAI API usage/billing

### Can't send replies?

- Verify `POSTMARK_TOKEN` is set: `npx wrangler secret list`
- Check Postmark's outbound message stream is enabled
- Verify sender domain is verified in Postmark

## Environment Variables

Required secrets (set with `wrangler secret put`):

```bash
# Your Postmark server token
npx wrangler secret put POSTMARK_TOKEN

# Webhook Basic Auth Username
npx wrangler secret put WEBHOOK_USERNAME

# Webhook Basic Auth Password
npx wrangler secret put WEBHOOK_PASSWORD

# Your OpenAI API key
npx wrangler secret put OPENAI_API_KEY
```

These should match what's in your `.dev.vars` for local development.

### Webhook Security (HTTP Basic Authentication)

To secure your Postmark inbound webhook, Rally now uses HTTP Basic Authentication. This means that when Postmark sends a webhook to your Worker, it will include an `Authorization` header with a username and password.

**You must configure your Postmark Inbound Stream with the following:**

1.  **Webhook URL**: `https://WEBHOOK_USERNAME:WEBHOOK_PASSWORD@your-subdomain.workers.dev/postmark/inbound`
    *   Replace `WEBHOOK_USERNAME` and `WEBHOOK_PASSWORD` with the actual username and password you set.
    *   Replace `your-subdomain.workers.dev` with your Worker's deployed URL.
2.  **Webhook Basic Auth Credentials**: Ensure the username and password in the URL match the `WEBHOOK_USERNAME` and `WEBHOOK_PASSWORD` environment variables set for your Worker.

**Without correct Basic Authentication credentials, inbound emails will be rejected by the Worker.**

## API Endpoints

- `POST /postmark/inbound` - Receive inbound message JSON, store, call OpenAI
- `GET /messages` - List all messages (JSON)
- `GET /messages/:id` - Get message detail (JSON)
- `GET /` - View recent messages (HTML)

## Next Steps

- Build the admin console (Cloudflare Pages)
- Add Cloudflare Access for authentication
- Implement R2 attachment storage
- Add manual re-process/re-send buttons

