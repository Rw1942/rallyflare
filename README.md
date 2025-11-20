# Email2ChatGPT – Product Documentation & User Journey

**Produced by Rally Collaboration**

## 1. Product Summary

Email2ChatGPT turns any email into a ChatGPT conversation. Users send an email to `chat@email2chatgpt.com`, and the service replies with AI-generated responses powered by GPT-5.1. No app. No login. No dashboard. Just email in, AI out.

It’s built for people and companies stuck behind firewalls, legacy environments, or restrictive IT policies. It works everywhere email works.

**Core idea:** AI that meets you where you already are: your inbox.

## 2. Admin Dashboard

The system includes a fast, mobile-friendly admin dashboard for managing the bot on the go.

**Dashboard URL:** `https://your-worker-url.workers.dev` (protected by Cloudflare Access)

### Features:
*   **Activity Stream:** Real-time view of Inbound/Outbound messages with status badges.
*   **User Management:**
    *   Searchable user list.
    *   **Conversation History:** See full timeline of user interactions with collapsible details, HTML previews, and consistent styling with the main messages view.
    *   **Per-User Settings:** Override AI model (GPT-5.1 vs Mini) and prompts for specific users.
    *   **GDPR Tools:** Export user data (JSON) or permanently delete/anonymize users.
*   **Global Settings:** Configure default AI behavior (System Prompt, Model, Reasoning Effort) for all users.

## 3. Primary Use Cases

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

## 4. Product Architecture Overview

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

## 5. Developer Guide & Setup

### Dashboard Development
The admin dashboard uses server-side rendered HTML with minimal vanilla JS to ensure speed and simplicity.
*   **Views:** Located in `services/ingest/src/dashboard/views/`.
*   **Shared Components:** Reusable UI elements (like message rows) are in `services/ingest/src/dashboard/views/shared.ts`.
*   **Layout:** `layout.ts` provides the common HTML shell.

### Quick Start

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Create D1 database**
   ```bash
   npx wrangler d1 create rally-database
   ```

3. **Create R2 bucket**
   ```bash
   npx wrangler r2 bucket create rally-attachments
   ```

4. **Run migrations**
   ```bash
   # Migrations must be applied manually since we use microservices
   # Check migrations/ folder for new .sql files and apply them:
   npx wrangler d1 execute rally-database --remote --command "YOUR SQL HERE"
   ```

5. **Set secrets**
   ```bash
   # Mailer needs Postmark token
   cd services/mailer && npx wrangler secret put POSTMARK_TOKEN
   # AI needs OpenAI key
   cd ../../services/ai && npx wrangler secret put OPENAI_API_KEY
   ```

6. **Deploy Services**
   ```bash
   # Deploy all services (order doesn't matter but dependencies first is good practice)
   npx wrangler deploy services/mailer/src/index.ts --name rally-mailer
   npx wrangler deploy services/attachments/src/index.ts --name rally-attachments
   npx wrangler deploy services/ai/src/index.ts --name rally-ai
   npx wrangler deploy services/ingest/src/index.ts --name rally-ingest
   ```

### Troubleshooting

**"JavaScript Exception" on Dashboard:**
*   This usually means a database query failed. Check that your D1 database has all tables created (`users`, `messages`, `email_settings`).
*   Use `npx wrangler tail rally-ingest` to see the exact error trace.

**AI Not Replying:**
*   Check `rally-ai` logs. Ensure your OpenAI API key is valid and has access to `gpt-5.1`.
*   Verify `rally-ingest` logs to see if it successfully handed off the request.

## License

MIT License - feel free to use Email2ChatGPT for personal or commercial projects.

---

**Credits**
Built with Cloudflare Workers, D1, Postmark, and OpenAI GPT-5.1.
Produced by Rally Collaboration.
