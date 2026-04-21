# Recon — Extend `platform_ai_config` for Recon-specific model overrides

## Agent
`recon-engineer` (A1).

## Skills
- Primary: `.claude/skills/spec-driven-development/`
- Supporting: `.claude/skills/whynot-dashboard/` (for admin-frontend surfacing)

## Dependencies
- A1, B1

## Task
Allow Recon to optionally override the LLM model tiers used by the executor, while defaulting to the platform-wide model selection from commit `578e8f3`. This lets ops dial up the "large" tier for Recon without affecting QA-loop costs.

### 1. Schema migration
- Migration `052_recon_ai_config.sql` (numbered after B1's `051_*`).
- Add columns to `platform_ai_config` (or a sibling table — match the existing shape; if the existing schema is a key-value store, add three new keys instead):
  - `recon_small_model TEXT NULL`
  - `recon_medium_model TEXT NULL`
  - `recon_large_model TEXT NULL`
- NULL means "fall back to the platform default for that tier."

### 2. AI service changes
- `services/ai-service/app/infrastructure/platform_config.py` — extend `get_platform_config()` return shape to include the new fields. Default to platform `small/medium/large` if unset.
- `services/ai-service/app/infrastructure/llm/llm_client.py` — `LLMClient` already takes a `model` argument per call (verify); no signature change. The Recon executor will pass the resolved model from platform config.

### 3. Recon executor consumption (forward reference to C1)
The Recon executor service queries the gateway's `/api/internal/ai-config` endpoint at startup (and refreshes every 60s) and uses:
- `recon_small_model` for summarization passes (default: platform small)
- `recon_medium_model` for vulnerability hypothesis generation (default: platform medium)
- `recon_large_model` for deep reasoning + exploitation strategy (default: platform large)

### 4. Admin UI
- `admin-frontend` — add three optional inputs to the Platform AI Config screen (find via `grep -r 'platform_ai_config' admin-frontend/`). Labels:
  - "Recon — Small Model (optional override)"
  - "Recon — Medium Model (optional override)"
  - "Recon — Large Model (optional override)"
- Empty input means "fall back to platform default."
- Help text: "Used only for Recon scans. Leave blank to inherit the platform-wide selection."

### Tests
- Repository test: writing/reading the three new fields, including NULL roundtrip.
- AI-service test: `get_platform_config()` returns defaults when overrides are NULL; returns overrides when set.
- Admin-frontend test: form save round-trips an empty string as NULL (not "").
- 100% coverage on changed lines.

### i18n
- Admin-frontend strings (5 locales, `admin-frontend` locale path):
  - `admin.ai.recon.small.label`, `.help`
  - `admin.ai.recon.medium.label`, `.help`
  - `admin.ai.recon.large.label`, `.help`
- No banned vocabulary in any locale (no model names, no provider names — those are dynamic, not translated).

### Documentation
- N/A in this prompt. Internal admin functionality.

### Files to modify
- `services/database/migrations/052_recon_ai_config.sql`
- `services/ai-service/app/infrastructure/platform_config.py`
- `services/ai-service/app/infrastructure/platform_config_test.py` (or wherever tests live)
- `admin-frontend/src/...` — Platform AI Config screen
- 5 admin-frontend locale files
