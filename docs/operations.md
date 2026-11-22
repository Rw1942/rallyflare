# Operations

Queries and checks for the live system. Run D1 commands from `services/ingest` (or add `-w services/ingest` to the npm scripts); `--remote` targets production, and leaving it out targets the local dev database in `.wrangler/state`.

## When replies stop

1. Find inbound mail that got no reply:
   ```bash
   npx wrangler d1 execute rally-database --remote --command "SELECT received_at, email_address, from_email FROM messages WHERE direction='inbound' AND llm_reply IS NULL ORDER BY received_at DESC LIMIT 20"
   ```
2. Look at `rally-ai` in Workers Logs (Code Mode, Workers observability telemetry, filter `$metadata.service` = `rally-ai`), or run `npm run tail -w services/ai` and send a test email. `AI: OpenAI API Error: <status> - <body>` carries OpenAI's own error. Two of these per email means the request failed with and without web search, which points at the key, the OpenAI account (billing, quota) or the model rather than at web search.
3. If `rally-ai` shows nothing, check `rallyflare` the same way (`Ingest Error:` lines) and Postmark's activity log for webhook failures (see `postmark-setup.md`).

When the AI call fails, `rallyflare` still emails the sender a short error message through `rally-mailer`, so a sender who got an error email means ingest, Access and Postmark are working.

## Useful queries

```bash
# Global settings (the system prompt is long, so it is left out)
npx wrangler d1 execute rally-database --remote --command "SELECT model, reasoning_effort, text_verbosity, max_output_tokens, web_search_enabled, web_search_context_size FROM project_settings WHERE project_slug='default'"

# Persona overrides
npx wrangler d1 execute rally-database --remote --command "SELECT email_address, model, reasoning_effort, text_verbosity, max_output_tokens FROM email_settings"

# Recent messages
npx wrangler d1 execute rally-database --remote --command "SELECT received_at, direction, email_address, from_email, subject, model FROM messages ORDER BY received_at DESC LIMIT 20"

# Cost and latency of recent replies
npx wrangler d1 execute rally-database --remote --command "SELECT received_at, model, tokens_input, tokens_output, reasoning_tokens, cost_dollars, processing_time_ms FROM messages WHERE llm_reply IS NOT NULL ORDER BY received_at DESC LIMIT 20"

# Table list and one table's columns
npx wrangler d1 execute rally-database --remote --command "SELECT name FROM sqlite_master WHERE type='table'"
npx wrangler d1 execute rally-database --remote --command "PRAGMA table_info(messages)"
```

Add `--json` for output a script can parse.

## Rollback

`npx wrangler rollback` from a service directory returns that Worker to its previous version. Roll back `rallyflare` together with any RPC Worker whose contract changed in the same release.
