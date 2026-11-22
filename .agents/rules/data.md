---
trigger: glob
globs: "migrations/**, services/ingest/**"
paths:
  - "migrations/**"
  - "services/ingest/**"
---

# D1 data

D1 database `rally-database` is bound only to `rallyflare` (`services/ingest`). The other Workers get what they need over RPC.

## Tables in use

- `messages`: one row per inbound email and one per reply sent (`direction` is `inbound` or `outbound`). An inbound row is updated after the AI call with the reply, token counts, timings, cost, model and web search usage. `email_address` is the Rally address that received the mail; `recipient_email` is the person.
- `participants`: the To and Cc addresses of each inbound message. `kind` has a CHECK constraint of `to`, `cc` or `bcc`.
- `users`: one row per correspondent. The trigger `trigger_update_user_on_inbound` (migration 0023) creates or updates the sender's row on every inbound insert.
- `project_settings`: the global AI settings in the row with `project_slug = 'default'`.
- `email_settings`: per-address persona overrides, keyed by `email_address`.
- `attachments`: R2 keys of stored attachments.

`processing_logs`, `requests`, `responses` and `user_interactions` exist from earlier designs and nothing reads or writes them.

## Settings cascade

`mergeSettings` in `services/ingest/src/utils/settingsMerge.ts` resolves the settings for each email: a non-null field in `email_settings` overrides `project_settings`, which overrides the hardcoded fallbacks. The persona `system_prompt` is appended to the global prompt rather than replacing it, because the global prompt carries the formatting rules. Web search settings are global only.

## Email addresses

All addresses are stored and compared in lowercase (migrations 0024 and 0027). Lowercase new addresses before writing them, and compare with `lower(...)` when reading older columns.

## Migrations

- Files are `migrations/NNNN_description.sql`, numbered in sequence. Wrangler records applied files in `d1_migrations`, so never edit a migration after it has been applied remotely; write a new one.
- SQLite has no `ADD COLUMN IF NOT EXISTS` and cannot change a CHECK constraint in place (that needs a table rebuild), so keep schema changes simple.
- Apply with `npm run db:migrate:remote` before deploying code that needs the change, and check with `npm run db:migrations:list`.
- Data changes that only bring stored defaults in line with code (such as a new default model) also go in migrations so every environment matches.
