# User AI config: schema, encrypted storage, endpoints, and Settings > AI tab

## Agent
`api-designer` (lead) + `design-ui-designer` + skill `claude-api` + skill `audit-logging`

## Depends on
`28-validate-ai-provider-factory.md`

## Goal
Allow each user to configure their own AI provider + API key + model. Keys are encrypted at rest. Provide CRUD endpoints, masked reads, audit logging, and a Settings > AI tab UI.

## Single source of truth
`ARCHITECTURE.md` section 6.

## Reference
`/home/serverlessbase/serverless-v2/serverlessbase/apps/serverlessbase/pages/dashboard/settings/ai.tsx`

## Untouchable paths (reminder)
- `services/qa-loop-executor/src/v2/`, `services/qa-loop-executor/src/mcp-browser.ts`, `services/database/migrations/` (new migration requires user coordination)

## Task

### 1. Coordinate migration with user
- After approval, create `services/database/migrations/0NN_user_ai_config.sql`:
  ```sql
  CREATE TABLE user_ai_config (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider text NOT NULL,
    model text NOT NULL,
    base_url text,
    api_key_encrypted bytea NOT NULL,
    api_key_iv bytea NOT NULL,
    api_key_tag bytea NOT NULL,
    is_default boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  );

  CREATE INDEX idx_user_ai_config_user ON user_ai_config(user_id);
  CREATE UNIQUE INDEX idx_user_ai_config_default ON user_ai_config(user_id) WHERE is_default;
  ```

### 2. Encryption util
- `gateway/src/utils/crypto/secret-cipher.ts`:
  - AES-256-GCM. Key from env `SECRETS_ENCRYPTION_KEY` (32 bytes, base64).
  - `encrypt(plaintext: string) → { ciphertext, iv, tag }`
  - `decrypt({ ciphertext, iv, tag }) → string`
  - Refuses to start if key missing or wrong size (fail-fast at gateway boot).

### 3. Repository
- `shared/database/repositories/user-ai-config-repository.ts`: list by user, get by id, create, update, delete, set-default (transactional: clears other defaults).

### 4. Endpoints
- `GET /api/me/ai-config` → list configs (api_key returned MASKED: `sk-•••••XXXX` showing last 4).
- `POST /api/me/ai-config` → create (body: provider, model, base_url, apiKey). Encrypts and stores.
- `PUT /api/me/ai-config/:id` → update (apiKey optional; only re-encrypt if provided).
- `PUT /api/me/ai-config/:id/default` → mark as default.
- `DELETE /api/me/ai-config/:id`.
- `POST /api/me/ai-config/:id/test` → uses `selectAIProvider` to do a 1-token completion; returns `{ ok: true, latencyMs }` or `{ ok: false, error }`.
- Every mutation writes an audit row: actor, action (`set` / `rotated` / `revoked` / `default-changed`), config id. **Audit row never contains plaintext or ciphertext.**

### 5. Internal accessor
- `gateway/src/utils/ai/get-user-ai-model.ts`: given `userId`, fetches the user's default config, decrypts the key, and returns a model from `selectAIProvider`. All non-v2 AI call sites that need a user-scoped model use this accessor. (v2 stays untouched.)

### 6. Settings > AI tab UI
- `frontend/src/pages/settings/tabs/AiTab.tsx`:
  - Lists configured providers; "Add provider" dialog.
  - Provider picker (OpenAI / Anthropic / Google / OpenRouter / Custom OpenAI-compatible).
  - Model picker (driven by a static catalog per provider; for Custom, free text).
  - API key field (password input, "show" toggle).
  - "Test connection" button → calls `POST /api/me/ai-config/:id/test`; shows latency + result.
  - "Set default" toggle.
  - All Shadcn primitives. Localized.
- Wire under `frontend/src/pages/SettingsPage.tsx` tab structure (full settings shell lands in prompt 55; this prompt only adds the AI tab + a minimal tab host that prompt 55 will extend).

### 7. i18n
- Keys: `settings:ai.title`, `settings:ai.addProvider`, `settings:ai.providerLabel`, `settings:ai.modelLabel`, `settings:ai.apiKeyLabel`, `settings:ai.testButton`, `settings:ai.testSuccess`, `settings:ai.testFailure`, `settings:ai.setDefault`, `settings:ai.delete`, `settings:ai.confirmDelete`. All 5 languages.

### Files to create/modify
- `services/database/migrations/0NN_user_ai_config.sql` — new (user-coordinated)
- `gateway/src/utils/crypto/secret-cipher.ts` — new
- `shared/database/repositories/user-ai-config-repository.ts` — new
- `gateway/src/api/me/ai-config.ts` — new
- `gateway/src/utils/ai/get-user-ai-model.ts` — new
- `frontend/src/pages/settings/tabs/AiTab.tsx` — new
- `frontend/src/pages/SettingsPage.tsx` — minimal tab host (extended in prompt 55)
- `frontend/src/router.tsx` — `/settings` route if not present
- `frontend/public/locales/{en,ar,fr,de,es}/settings.json` — new keys

### Tests
- Unit: encryption round-trip; tampered ciphertext → decryption error.
- Unit: missing/short env key → throws on init.
- Repository: CRUD, set-default transactional behavior.
- Supertest: each endpoint, including auth (cross-user 403) and key-masking on GET responses.
- Supertest: audit row created on each mutation; contents verified to NOT contain plaintext or ciphertext.
- Supertest: test-connection path with stub provider.
- Vitest component tests for AiTab.
- Playwright e2e: add provider → test connection → set default → trigger a feature that calls `getUserAIModel` → verify the right provider is used (assert via stub network capture).
- Coverage: 100% for touched files.

### i18n
- All UI text via `t()`. Backend errors localized.

### Documentation
- `docs/{en,ar,fr,de,es}/ai/user-config.md` — explains the feature, encryption guarantees, supported providers, and the Settings > AI tab.

### Acceptance criteria
- [ ] Migration applies; encryption key required at boot.
- [ ] Keys never returned in plaintext from any GET endpoint.
- [ ] Audit rows never contain plaintext or ciphertext.
- [ ] Set-default is transactional (only one default per user).
- [ ] Test-connection works against all 5 provider families.
- [ ] AI tab functional, localized, accessible.
- [ ] 100% coverage on touched files.
- [ ] No untouchable path changes.
