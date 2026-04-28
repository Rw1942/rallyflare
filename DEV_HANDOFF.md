# Dev Handoff: OpenAI Endpoint & Model Compliance (April 2026)

## What Changed

### Phase 1: API Endpoint Compliance

#### 1. File Upload Purpose (`services/ai/src/index.ts`)
- Changed `purpose: "assistants"` to `purpose: "user_data"` in `uploadFileToOpenAI()`.
- **Why:** OpenAI docs now recommend `user_data` for files passed as `input_file` to the Responses API. The `assistants` purpose is for the legacy Assistants API (deprecated 2026).

#### 2. System Prompt via `instructions` (`services/ai/src/index.ts`)
- Moved the system prompt from a `system` role message inside the `input` array to the top-level `instructions` field.
- **Why:** The Responses API supports `instructions` as a first-class parameter, providing cleaner separation between system context and user input.

#### 3. `store: false` (`services/ai/src/index.ts`)
- Added `store: false` to the Responses API payload.
- **Why:** Responses are stored by default on OpenAI's side. Since we process private email content, we opt out of server-side retention.

#### 4. Robust Response Parsing (`services/ai/src/index.ts`)
- Replaced single-item `output[0].content[0].text` extraction with an aggregator that iterates all `message`-type items in the `output` array and concatenates every `output_text` part.
- Added explicit handling for `refusal`-type content parts (model safety refusals).
- Falls back to the SDK-style `json.output_text` convenience field when the `output` array is absent.
- Logs `output` item types for production debuggability.
- **Why:** The `output` array can contain reasoning items, tool calls, and multiple messages. The old parser would silently lose text or throw on unexpected shapes.

#### 5. Removed `temperature` from `AiResponse` (`shared/types/api.ts`)
- Dropped the `temperature` field from `AiResponse`.
- **Why:** GPT-5 models do not support `temperature`; it was a leftover from GPT-4 era.

### Phase 2: Model Upgrade (gpt-5.1 -> gpt-5.4)

#### 6. Default Model Updated to `gpt-5.4`
- **`services/ingest/src/index.ts`**: `DEFAULT_MODEL` changed from `gpt-5.1` to `gpt-5.4`.
- **`services/ingest/src/utils/settingsMerge.ts`**: Hardcoded fallback model changed to `gpt-5.4`, pricing updated to $2.50/$15.00.
- **Why:** GPT-5.1 was retired from ChatGPT on March 11, 2026. The `gpt-5.1-chat-latest` and `gpt-5.1-codex` snapshots have an **API shutdown date of July 23, 2026**. OpenAI recommends `gpt-5.4` as the direct successor. Since this app is "ChatGPT via email," it should use the same model generation as ChatGPT.

#### 7. Expanded Model Allowlist
- **`services/ingest/src/index.ts`**: `ALLOWED_MODELS` updated to `["gpt-5.5", "gpt-5.4", "gpt-5.4-mini", "gpt-5-mini"]`.
- Applied to all three settings write paths: `POST /settings`, `POST /personas`, `POST /personas/:email/edit`.
- Invalid model values are rejected with a console warning and fall back to `gpt-5.4`.
- **Why:** Broader model lineup gives admins cost/quality flexibility. `gpt-5.5` (frontier, $5/$30), `gpt-5.4` (recommended, $2.50/$15), `gpt-5.4-mini` (strong mini, $0.75/$4.50), `gpt-5-mini` (budget, $0.25/$2).

#### 8. Dashboard Model Dropdowns Updated
- Updated `<select>` options in `settings.ts`, `personas.ts`, and `userDetail.ts` to show the four supported models with descriptive labels.

#### 9. D1 Migration (`migrations/0028_update_model_to_gpt5_4.sql`)
- Migrates all stored `gpt-5.1` (and older) model values in `project_settings` and `email_settings` to `gpt-5.4`.
- Updates cost columns to match gpt-5.4 pricing.

#### 10. Internal Developer Guidance
- Updated `.cursor/rules/openaiapi.mdc` and `.cursor/rules/rally.mdc` with new model names, pricing, deprecation warnings, and `reasoning.effort` now supports `none` and `xhigh`.

## Files Modified

| File | Change Summary |
|------|---------------|
| `services/ai/src/index.ts` | File purpose, instructions field, store:false, robust parser |
| `shared/types/api.ts` | Removed `temperature` from `AiResponse` |
| `services/ingest/src/index.ts` | Model allowlist updated to gpt-5.5/5.4/5.4-mini/5-mini, default=gpt-5.4 |
| `services/ingest/src/utils/settingsMerge.ts` | Default model=gpt-5.4, pricing=$2.50/$15.00 |
| `services/ingest/src/dashboard/views/settings.ts` | Model dropdown: 4 options |
| `services/ingest/src/dashboard/views/personas.ts` | Model dropdown: 4 options |
| `services/ingest/src/dashboard/views/userDetail.ts` | Model dropdown: 4 options |
| `migrations/0028_update_model_to_gpt5_4.sql` | Migrate stored gpt-5.1 values to gpt-5.4 |
| `.cursor/rules/openaiapi.mdc` | Updated model names, pricing, streaming, file purpose |
| `.cursor/rules/rally.mdc` | Updated model names, deprecation warnings, reasoning effort values |

## Rollout / Testing Notes

- **Migration required:** Run `0028_update_model_to_gpt5_4.sql` before deploying code.
  ```bash
  cd services/ingest && npx wrangler d1 migrations apply rally-database --remote
  ```
- **Deploy order:** Migration first, then `rally-ai`, then `rally-ingest`.
- **Smoke tests:**
  1. Send a plain-text email and verify AI reply arrives with `model = gpt-5.4` in D1.
  2. Send an email with a PDF attachment and verify file upload succeeds (check logs for `purpose: user_data`).
  3. Attempt to POST an invalid model value via curl to `/settings`; confirm it falls back to `gpt-5.4`.
  4. Verify dashboard dropdowns show the four new model options.
  5. Check `wrangler tail rally-ai` for the new "Output item types:" log line.

## Follow-up Risks

- **GPT-5.1 shutdown (2026-07-23):** The base `gpt-5.1` slug may also stop working around this date. This migration removes all stored references, but monitor for any hardcoded usage that was missed.
- **Cost increase:** GPT-5.4 output tokens cost $15/1M vs GPT-5.1's $10/1M (50% increase). Monitor spend and consider defaulting to `gpt-5.4-mini` ($4.50/1M output) for cost-sensitive deployments.
- **`user_data` purpose:** Monitor for any 400 errors after deploy in case OpenAI tightens validation.
- **Refusal handling:** The refusal fallback returns a user-visible message. Consider whether this should be a softer error or an admin notification in production.
- **Model list maintenance:** When OpenAI releases new models, update `ALLOWED_MODELS` in `services/ingest/src/index.ts` and the dashboard dropdowns.
