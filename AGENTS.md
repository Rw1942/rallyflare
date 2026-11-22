# Rallyflare

Rallyflare runs Email2ChatGPT. People email an address such as `chat@email2chatgpt.com`, Postmark posts the message to a webhook, and the service replies by email with an answer from an OpenAI model. An admin dashboard on the same Worker manages the global AI settings, per-address personas, users and message history. It is four Cloudflare Workers in an npm workspace that call each other over service-binding RPC, with D1 for data and R2 for attachments.

## Commands

Run from the repository root. A fresh checkout or cloud session needs `npm ci` first.

| Task | Command |
|---|---|
| Local dev: all four Workers in one process | `npm run dev` |
| Checks: typecheck and a dry-run build of each Worker | `npm run check` |
| Deploy all four Workers in dependency order | `npm run deploy` |
| Deploy one Worker | `npm run deploy -w services/<ingest, ai, mailer or attachments>` |
| Apply D1 migrations remotely | `npm run db:migrate:remote` |
| Show which migrations are applied remotely | `npm run db:migrations:list` |
| Regenerate binding types after a config change | `npm run types` |
| Live logs for one Worker | `npm run tail -w services/<name>` |

`npm run check` is the gate for every change: run it before deploying and report its result. There are no unit tests.

## Layout

- `services/ingest/`: Worker `rallyflare`. The Postmark webhook (`POST /postmark/inbound`, `src/handlers/inbound.ts`), the server-rendered dashboard (`src/dashboard/`), the settings cascade and the outbound email formatting (`src/utils/`). It orchestrates the other three Workers.
- `services/ai/`: Worker `rally-ai`. `generateReply` calls the OpenAI Responses API, and the Files API for document attachments.
- `services/mailer/`: Worker `rally-mailer`. `sendEmail` sends through the Postmark API.
- `services/attachments/`: Worker `rally-attachments`. `uploadAttachment` stores inbound attachments in R2.
- `shared/types/`: the RPC contracts (`AiRequest`, `AiResponse`, `EmailReply`) and the Postmark inbound payload type, imported as `shared/types`.
- `migrations/`: D1 migrations. They run through the ingest config, whose `migrations_dir` is `../../migrations`.
- `docs/`: reference docs, indexed in `docs/README.md`.

Each service has its own `wrangler.jsonc`, `tsconfig.json` (extending `tsconfig.base.json`) and generated `worker-configuration.d.ts`. The root has no Wrangler config, so run Wrangler through the npm scripts or from inside `services/<name>`.

## Cloudflare

- Account `3c526a82504f460f254335ac81d313dd`, workers.dev subdomain `rick-wills`. Every Worker has workers.dev and preview URLs on.
- `rallyflare` serves https://rallyflare.rick-wills.workers.dev. Bindings: D1 `DB` (`rally-database`) and services `AI`, `MAILER` and `ATTACHMENTS`. Secrets: `WEBHOOK_USERNAME` and `WEBHOOK_PASSWORD`, the HTTP Basic Auth credentials embedded in Postmark's webhook URL. Cloudflare Access protects the hostname: the dashboard redirects to the Access login, and `/postmark/inbound` has its own Access application that lets Postmark through and answers other callers with 403.
- `rally-ai` has secret `OPENAI_API_KEY`. `rally-mailer` has secret `POSTMARK_TOKEN` and var `POSTMARK_URL`. `rally-attachments` binds R2 bucket `rally-attachments` as `BUCKET`. Their workers.dev URLs only answer a health check; the real interface is RPC from `rallyflare`.
- Secret names are listed in each config's `secrets.required`, so a deploy fails if one is missing. Local values go in `.dev.vars` next to each service's `wrangler.jsonc` (copy the `.dev.vars.example` there).
- Workers Logs and traces are on for all four Workers. Query them through Code Mode (Workers observability telemetry) or use `npm run tail -w services/<name>`.
- Agents deploy and change infrastructure directly. Wrangler (the repository's pinned copy) handles deploys, rollbacks, D1 migrations and queries, secrets and `wrangler tail`; use the commands above when one fits. This project uses Wrangler, so do not run `cf dev`, `cf build`, `cf deploy` or `cf migrate`.
- Cloudflare Code Mode (`cloudflare-api` MCP server) covers the rest of the account: DNS, routes and domains, Worker settings, logs and analytics, other projects, and the Cloudflare docs. Call `search` to find an endpoint, then `execute` with `account_id` set to the account ID above. Results are cut off at about 6,000 tokens, so filter inside the code.
- Both act on production; there is no staging environment. Wrangler and Code Mode read `CLOUDFLARE_API_TOKEN`. The account-wide standard, token permissions and the inventory of every project are in the `Rw1942/cloudflare-account` repo.

## Working here

- Commit to `main` with a conventional prefix (`feat:`, `fix:`, `docs:`, `refactor:`, `chore:`) and deploy once checks pass. Deploy only the Worker you changed, or everything with `npm run deploy`. When an RPC contract in `shared/types/` changes, deploy attachments, ai and mailer before ingest, which is the order `npm run deploy` uses.
- Apply a new migration with `npm run db:migrate:remote` before deploying code that reads the new schema.
- Deploys run from the agent session with Wrangler. Workers Builds is not used.
- Each secret stays in the Worker that needs it: the OpenAI key only in `rally-ai`, the Postmark token only in `rally-mailer`. Add new external calls to the Worker that owns the credential and expose them over RPC.
- The dashboard is HTML built from template strings in `src/dashboard/`, with a little inline JavaScript and no build step. Keep it that way.
- After a change to the webhook or reply path, check it by sending a real email to one of the addresses and watching `npm run tail -w services/ingest` and `npm run tail -w services/ai`. Posting to the webhook yourself sends real replies through Postmark.

## Things that are easy to get wrong

- `services/ingest` uses the generated global `Env`, whose service bindings are typed from the other Workers' source because `npm run types` passes all four configs. The RPC Workers keep a module-local `Env` interface instead, since the ingest typecheck imports their source and the global `Env` there is the ingest one.
- `participants.kind` only allows `to`, `cc` and `bcc`; the sender lives in `messages.from_email`.
- Inbound emails are deduplicated on `postmark_message_id`, and mail from the Rally address itself is ignored to prevent reply loops. Keep both checks ahead of any side effect.
- The supported OpenAI model list is repeated in several files; `.agents/rules/openai.md` lists them.
- The migrations do not replay on an empty database: `0013_rename_verbosity_to_text_verbosity.sql` fails with `no such column: "verbosity"` because no earlier migration creates `project_settings.verbosity`; production got that column outside the migration files. `npm run dev` therefore starts with an empty local D1, and dashboard pages return 500 locally until that is fixed with a baseline schema. Never "fix" this by editing applied migrations.

## Rules and reference

Rules in `.agents/rules/` hold decisions that are not visible in the code. Claude Code and Antigravity load them automatically; other agents should read the one that matches the files they are changing.

- `.agents/rules/writing-style.md`: the owner's writing rules for copy, docs, commit messages and replies.
- `.agents/rules/openai.md`: how `rally-ai` calls OpenAI, the supported models and where the model list is kept.
- `.agents/rules/data.md`: the D1 tables, the settings cascade and how to write migrations.

For the Postmark webhook and Access setup, read `docs/postmark-setup.md`. For D1 queries and troubleshooting missing replies, read `docs/operations.md`.
