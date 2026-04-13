# Port the AI provider factory (`selectAIProvider`) into the gateway

## Agent
`api-designer` (lead) + skill `claude-api`

## Depends on
`26-validate-feature-flags-frontend-and-admin.md`

## Goal
Bring the multi-provider AI factory from the reference repo into `gateway/`. This is the single entry point all non-v2 AI calls route through, supporting OpenAI, Anthropic, Google, OpenRouter, and arbitrary OpenAI-compatible endpoints. **Do not touch `services/qa-loop-executor/src/v2/`.**

## Single source of truth
`ARCHITECTURE.md` section 6.

## Reference
- `/home/serverlessbase/serverless-v2/serverlessbase/packages/server/src/utils/ai/select-ai-provider.ts`
- Recent fix on this branch: commit `e231a08` — OpenRouter must use `createOpenAICompatible`, NOT the Responses API.

## Untouchable paths (reminder)
- `services/qa-loop-executor/src/v2/` — read-only reference; the v2 engine has its own provider wiring and we do not modify it
- `services/qa-loop-executor/src/mcp-browser.ts`
- `services/database/migrations/`

## Task

### 1. Port the factory
- `gateway/src/utils/ai/select-ai-provider.ts`:
  - Detects provider from URL/baseUrl pattern OR explicit `provider` field.
  - Returns the appropriate `LanguageModelV1` instance from `ai-sdk`.
  - **OpenRouter**: uses `createOpenAICompatible({ name: 'openrouter', baseURL: 'https://openrouter.ai/api/v1', apiKey })` — must NOT use `createOpenAI` (which routes to the Responses API and errors with the OpenRouter endpoint).
  - **OpenAI**: `createOpenAI({ apiKey })`
  - **Anthropic**: `createAnthropic({ apiKey })`
  - **Google**: `createGoogleGenerativeAI({ apiKey })`
  - **OpenAI-compatible (custom)**: `createOpenAICompatible({ name, baseURL, apiKey })`
  - Throws a typed error on unknown provider.

### 2. Provider-detection helper
- `gateway/src/utils/ai/detect-provider.ts` — pure function from URL → provider name; covers all reference URL patterns.

### 3. Sweep existing non-v2 AI call sites in gateway
- `grep` for direct provider imports under `gateway/src/` (excluding the new factory itself). Replace each direct call with `selectAIProvider(userConfig)`.
- **Do not touch** any file under `services/qa-loop-executor/src/v2/` — that engine has its own AI wiring and is untouchable.

### 4. ARCHITECTURE.md
- Update section 6: add the factory path, the supported providers, the OpenRouter `createOpenAICompatible` rule (with a one-line "why" referencing commit `e231a08`).

### Files to create/modify
- `gateway/src/utils/ai/select-ai-provider.ts` — new
- `gateway/src/utils/ai/detect-provider.ts` — new
- `gateway/src/**` — call sites updated (excluding v2)
- `ARCHITECTURE.md` — section 6 updated

### Tests
- Unit: every URL pattern → expected provider.
- Unit: invalid URL throws.
- Unit: OpenRouter detection returns a model from `createOpenAICompatible` (assert by checking the underlying constructor name).
- Integration: stubbed call through each provider returns a non-empty completion (mock the network).
- Coverage: 100% for touched files.

### i18n
- Error messages thrown by the factory carry i18n keys (e.g. `errors:ai.unknownProvider`); add to all 5 language files.

### Documentation
- `docs/{en,ar,fr,de,es}/ai/providers.md` — explains the supported provider matrix and the OpenRouter caveat.

### Acceptance criteria
- [ ] Factory supports all 5 provider families.
- [ ] OpenRouter routes via `createOpenAICompatible` only.
- [ ] All non-v2 gateway call sites use the factory.
- [ ] 100% coverage on touched files.
- [ ] No edits inside `services/qa-loop-executor/src/v2/` or `mcp-browser.ts`.
- [ ] `ARCHITECTURE.md` section 6 updated.
