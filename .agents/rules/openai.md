---
trigger: glob
globs: "services/ai/**, shared/types/**, services/ingest/src/index.ts, services/ingest/src/utils/settingsMerge.ts, services/ingest/src/dashboard/views/**"
paths:
  - "services/ai/**"
  - "shared/types/**"
  - "services/ingest/src/index.ts"
  - "services/ingest/src/utils/settingsMerge.ts"
  - "services/ingest/src/dashboard/views/**"
---

# OpenAI

`rally-ai` calls OpenAI over plain `fetch` to the Responses API (`POST https://api.openai.com/v1/responses`); there is no SDK and no Chat Completions call. Keep it that way so the Worker stays small and the payload is visible in one place (`services/ai/src/index.ts`).

## Request shape

- The system prompt goes in the top-level `instructions` field, and the email (conversation history, current message, attachment list) goes in one `user` input item.
- `store: false` is set on every request because the content is private email. Keep it.
- Tuning uses `reasoning.effort`, `text.verbosity` and `max_output_tokens`. GPT-5 models reject `temperature` and `top_p` with a 400, so do not add them.
- Document attachments are uploaded to the Files API with `purpose: "user_data"` and referenced as `input_file` items. Images are skipped because the ingest Worker already describes them in the text.
- When web search is on in the global settings, the request adds the `web_search` tool and `include: ["web_search_call.action.sources"]`. If that request fails, `rally-ai` retries once without the tool so a reply still goes out. A failure of both calls throws, and the ingest Worker then emails the sender an error message.
- The reply text is collected from every `output_text` part of every `message` item in `output`; a `refusal` part becomes a short explanation to the sender.

## Supported models

The dashboard offers `gpt-5.5` (default), `gpt-5.4`, `gpt-5.4-mini` and `gpt-5-mini`. The list is repeated, so change all of these together:

- `ALLOWED_MODELS` and `DEFAULT_MODEL` in `services/ingest/src/index.ts`, which reject unknown values from the settings forms.
- The `<select>` options in `services/ingest/src/dashboard/views/settings.ts`, `personas.ts` and `userDetail.ts`.
- The hardcoded fallback model and its prices (`cost_input_per_1m`, `cost_output_per_1m`) in `services/ingest/src/utils/settingsMerge.ts`.
- The stored defaults in D1 (`project_settings.model` and the cost columns), changed with a migration such as `migrations/0030_default_model_to_gpt5_5.sql`.

The footer of each reply shows the model OpenAI reports in the response (`json.model`), which can be a dated snapshot of the requested model.
