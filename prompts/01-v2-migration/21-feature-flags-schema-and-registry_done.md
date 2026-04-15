# Feature flags: DB schema, registry, and seeds

## Agent
`api-designer` (lead) + skill `feature-flag-implementation`

## Depends on
`20-validate-translations-completeness-and-rendering.md`

## Goal
Introduce a DB-backed feature-flag system: two tables (`feature_flags`, `organization_feature_flags`), a typed registry of platform feature keys, and seeds for default flag state. Backend logic and UI come in prompts 23 and 25 respectively.

## Single source of truth
`ARCHITECTURE.md` section 10. Update at the end of this prompt.

## Reference
- `/home/serverlessbase/serverless-v2/serverlessbase/packages/server/src/db/schema/feature-flag.ts`
- `/home/serverlessbase/serverless-v2/serverlessbase/packages/server/src/constants/platform-features.ts`

## Untouchable paths (reminder)
- `services/qa-loop-executor/src/v2/`, `services/qa-loop-executor/src/mcp-browser.ts`, `services/database/migrations/` — **new** migrations require user coordination; existing files are untouched.

## Task

### 1. Coordinate with user on new migration
- Do NOT write the migration without user confirmation of the next ordinal.
- Once approved, create `services/database/migrations/0NN_feature_flags.sql` (raw SQL, project convention) with:
  ```sql
  CREATE TABLE feature_flags (
    key text PRIMARY KEY,
    name text NOT NULL,
    description text,
    default_enabled boolean NOT NULL DEFAULT false,
    rollout_percent integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  );

  CREATE TABLE organization_feature_flags (
    organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    flag_key text NOT NULL REFERENCES feature_flags(key) ON DELETE CASCADE,
    enabled boolean NOT NULL,
    set_by uuid REFERENCES users(id),
    set_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (organization_id, flag_key)
  );

  CREATE INDEX idx_org_feature_flags_org ON organization_feature_flags(organization_id);
  ```

### 2. Registry
- Create `shared/constants/platform-features.ts`:
  ```ts
  export const PLATFORM_FEATURES = {
    AI_MULTI_PROVIDER: 'ai_multi_provider',
    PAYG_BILLING: 'payg_billing',
    LANDING_LEAD_CAPTURE: 'landing_lead_capture',
    ADVANCED_ANALYTICS: 'advanced_analytics',
    SUPERADMIN_IMPERSONATION: 'superadmin_impersonation',
    LANGUAGE_SWITCHER: 'language_switcher',
  } as const;

  export type PlatformFeatureKey = (typeof PLATFORM_FEATURES)[keyof typeof PLATFORM_FEATURES];

  export const ALL_PLATFORM_FEATURE_KEYS: PlatformFeatureKey[] = Object.values(PLATFORM_FEATURES);

  export function isValidFeatureKey(key: string): key is PlatformFeatureKey {
    return (ALL_PLATFORM_FEATURE_KEYS as string[]).includes(key);
  }
  ```

### 3. Seed
- `shared/database/seeds/feature-flags.ts` (or wherever the project keeps seed scripts) — one row per registry entry with `default_enabled` set sensibly (defaults: false except `LANGUAGE_SWITCHER: true`).
- Idempotent (`ON CONFLICT (key) DO UPDATE SET name=EXCLUDED.name, description=EXCLUDED.description`).

### Files to create/modify
- `services/database/migrations/0NN_feature_flags.sql` — new (after user-confirmed ordinal)
- `shared/constants/platform-features.ts` — new
- `shared/database/seeds/feature-flags.ts` — new
- `ARCHITECTURE.md` — section 10 updated with table shapes + registry path

### Tests
- Unit: `isValidFeatureKey` returns true for every registry value, false for unknown.
- Migration test: apply migration in a fresh test DB; introspect `pg_tables`; assert columns + types.
- Seed test: run seed twice; assert row count unchanged (idempotency).

### i18n
- Flag display names + descriptions are stored in DB in English. UI in prompt 25 will translate via i18n keys keyed off the slug.

### Documentation
- `docs/{en,ar,fr,de,es}/feature-flags/architecture.md` — explains the two-table model, registry-as-source-of-truth, and how to add a new flag.

### Acceptance criteria
- [ ] User confirmed the migration ordinal before file write.
- [ ] Migration applies cleanly + (manual) rollback documented.
- [ ] Registry exports the expected types.
- [ ] Seeds populate correctly and are idempotent.
- [ ] `ARCHITECTURE.md` section 10 updated.
- [ ] Coverage for touched files = 100%.
