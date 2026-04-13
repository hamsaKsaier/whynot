# Validate: AI provider factory

## Agent
`api-designer` (verifier) + skill `claude-api`

## Depends on
`27-ai-provider-factory-port.md`

## Goal
Verify the AI factory routes all supported providers correctly, OpenRouter does not regress to the Responses API error, and no untouchable file was modified.

## Validation steps

### 1. Static + unit
- `bun typecheck`, `bun lint` → exit 0
- `bun vitest run gateway/src/utils/ai/__tests__/select-ai-provider.test.ts` → all pass
- Test cases: openai, anthropic, google, openrouter, custom-openai-compatible, unknown.

### 2. OpenRouter regression
- Stand up a stub server that mimics the OpenRouter chat-completions endpoint.
- Call the factory with an OpenRouter URL + key, run a small prompt through `generateText`, assert: response received, no `Responses API` error string in logs.

### 3. Untouchable path audit
- `git diff --name-only HEAD~1 HEAD | grep -E '^(services/qa-loop-executor/src/v2/|services/qa-loop-executor/src/mcp-browser\.ts|services/database/migrations/)'` → must return zero lines.

### 4. Sweep coverage
- Search the codebase for remaining direct `createOpenAI`, `createAnthropic`, `createGoogleGenerativeAI` imports in `gateway/src/` (excluding the factory and tests). Should be zero.

### 5. i18n
- `errors:ai.unknownProvider` exists in all 5 languages.

### 6. Coverage + regression
- Touched files at 100%.
- Earlier-phase suites still green.

## Pass criteria
- [ ] All commands above exit 0.
- [ ] OpenRouter test passes without Responses-API error.
- [ ] Untouchable paths untouched.
- [ ] Direct provider imports outside the factory: 0.
- [ ] No regressions.

## On failure
- Re-open `27-ai-provider-factory-port.md`; fix; rerun.
- Do NOT advance to prompt 29 until this validation passes.
