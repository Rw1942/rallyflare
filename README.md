# Rallyflare (Email2ChatGPT)

Email2ChatGPT answers email with an OpenAI model. Someone writes to an address such as `chat@email2chatgpt.com`, Postmark forwards the message to a Cloudflare Worker, and the reply comes back in the same thread, with a short footer showing the model, time and cost. It is meant for people who can use email but not AI web apps, for example on locked-down work devices. Each receiving address can have its own persona (system prompt and model settings), and replies go to everyone on the original To and Cc lines.

An admin dashboard at https://rallyflare.rick-wills.workers.dev, behind Cloudflare Access, shows recent activity, messages, users and personas, and holds the global settings: system prompt, model, reasoning effort, output length and web search.

## How it works

Four Workers, each deployed separately from `services/`:

| Worker | Directory | Job |
|---|---|---|
| `rallyflare` | `services/ingest` | Postmark webhook, dashboard, D1 database, orchestration |
| `rally-ai` | `services/ai` | OpenAI Responses API calls, file uploads |
| `rally-mailer` | `services/mailer` | Sending replies through Postmark |
| `rally-attachments` | `services/attachments` | Storing attachments in R2 |

```
Postmark -> rallyflare -> rally-ai -> OpenAI
               |   \
               |    -> rally-mailer -> Postmark
               |    -> rally-attachments -> R2
               D1
```

`rallyflare` calls the other three over service-binding RPC, so only `rally-ai` holds the OpenAI key and only `rally-mailer` holds the Postmark token.

## Development

You need Node 22.12 or later and a `CLOUDFLARE_API_TOKEN` for account `3c526a82504f460f254335ac81d313dd` in your environment.

```bash
npm ci
npm run dev       # all four Workers locally (the local D1 starts empty, see AGENTS.md)
npm run check     # typecheck and dry-run builds
npm run deploy    # deploy all four Workers
```

For local secrets, copy `.dev.vars.example` to `.dev.vars` in `services/ingest`, `services/ai` and `services/mailer` and fill in the values. `AGENTS.md` has the full command list and project conventions, and `docs/` has the Postmark setup and operations notes.

## License

MIT
