# Postmark Webhook Setup Guide

## Overview

Email2ChatGPT receives inbound emails via Postmark webhooks. When someone sends an email to your Email2ChatGPT address (e.g., `chat@email2chatgpt.com`), Postmark will forward the email data to your Cloudflare Worker.

## Setup Steps

### 1. Deploy Your Workers

First, deploy all services to get the public URLs:

```bash
# Navigate to project root
cd /path/to/rallyflare

# Deploy each service
cd services/mailer && npx wrangler deploy
cd ../ai && npx wrangler deploy
cd ../attachments && npx wrangler deploy
cd ../ingest && npx wrangler deploy
```

Your main webhook URL will be: `https://rallyflare.your-subdomain.workers.dev`

### 2. Configure Cloudflare Access Bypass

**IMPORTANT:** Before configuring Postmark, you must set up Cloudflare Access to allow webhooks through.

1. Go to **Cloudflare Dashboard → Zero Trust → Access → Applications**
2. Click **"Add an application"** → **"Self-hosted"**
3. **Application Name:** "Postmark Webhook Bypass"
4. **Domain:** `rallyflare.your-subdomain.workers.dev`
5. **Path:** `/postmark/inbound`
6. Click **Next**, then **Add a policy**:
   - **Policy Name:** "Bypass for Everyone"
   - **Action:** Bypass
   - **Rule type:** Include
   - **Selector:** Everyone
7. **Save** the application

**Why?** Without this bypass, Cloudflare Access will block Postmark webhooks with a 302 redirect to the login page, and emails will not be processed.

### 3. Configure Postmark Inbound Stream

1. Log into your [Postmark account](https://account.postmarkapp.com/)
2. Go to **Servers** → Select your server → **Settings** → **Inbound**
3. Create a new **Inbound Stream** or edit existing one
4. Set the **Webhook URL** to:
   ```
   https://Rick:123@rallyflare.your-subdomain.workers.dev/postmark/inbound
   ```
   (Replace `Rick` and `123` with your `WEBHOOK_USERNAME` and `WEBHOOK_PASSWORD` from `wrangler.toml`)

### 4. Add Inbound Domain/Email Address

1. In the same Inbound settings, add your domain or set up a forwarding address
2. Common options:
   - **Option A**: Use a Postmark-provided address (e.g., `abc123@inbound.postmarkapp.com`)
   - **Option B**: Configure your own domain's MX records to point to Postmark
     - MX Priority 10: `inbound.postmarkapp.com`

### 5. Test the Integration

Send a test email to your configured address. You can verify it worked by:

1. Check your worker logs:
   ```bash
   # Tail the ingest worker logs
   cd services/ingest
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
  "To": "chat@email2chatgpt.com",
  "Subject": "Project Update",
  "TextBody": "Here's the update...",
  "HtmlBody": "<p>Here's the update...</p>",
  "MessageID": "abc123",
  "Date": "2025-10-09T12:00:00Z",
  "Attachments": []
}
```

## What Email2ChatGPT Does

When Email2ChatGPT receives the webhook:

1. **Stores** the email in D1 database
2. **Extracts** participants (To, Cc, etc.)
3. **Processes** the content with OpenAI
4. **Sends** an automated reply via Postmark
5. **Logs** everything for the admin console

## Troubleshooting

### Email not received?

- **Check Cloudflare Access first!** If you get 302 redirects, the webhook bypass isn't configured properly.
- Verify Bypass policy exists for `/postmark/inbound` path
- Check Postmark's Activity log in their dashboard
- Verify webhook URL includes Basic Auth credentials: `https://Rick:123@...`
- Check Ingest Worker logs: `cd services/ingest && npx wrangler tail`

### Getting 302 redirects?

This means Cloudflare Access is blocking the webhook. You need to:
1. Create a separate Bypass application for `/postmark/inbound`
2. Set the policy action to "Bypass" with "Include Everyone"
3. Save and wait a few seconds for changes to propagate

### OpenAI not working?

- Verify `OPENAI_API_KEY` is set in AI service: `cd services/ai && npx wrangler secret list`
- Check OpenAI API usage/billing
- Ensure you have access to GPT-5.1 and the Responses API

### Can't send replies?

- Verify `POSTMARK_TOKEN` is set in Mailer service: `cd services/mailer && npx wrangler secret list`
- Check Postmark's outbound message stream is enabled
- Verify sender domain is verified in Postmark

### Attachments not processing?

- Check that the AI service was deployed with the latest code
- Verify the multipart helper is working: check logs for "Processing attachment: filename"
- Ensure OpenAI API supports file attachments for your account

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

To secure your Postmark inbound webhook, Email2ChatGPT now uses HTTP Basic Authentication. This means that when Postmark sends a webhook to your Worker, it will include an `Authorization` header with a username and password.

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
