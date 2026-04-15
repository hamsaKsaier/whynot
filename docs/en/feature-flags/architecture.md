# Feature Flag Architecture

## Two-Table Model

The feature flag system uses two database tables:

### `feature_flags` — Global Flag Definitions

| Column | Type | Description |
|--------|------|-------------|
| `key` | `text` (PK) | Snake_case identifier, matches registry |
| `name` | `text` | Human-readable display name |
| `description` | `text` | What the flag controls |
| `default_enabled` | `boolean` | Default state for new organizations |
| `rollout_percent` | `integer` | Percentage rollout (0–100) |
| `created_at` | `timestamptz` | Row creation time |
| `updated_at` | `timestamptz` | Last modification time |

### `organization_feature_flags` — Per-Org Overrides

| Column | Type | Description |
|--------|------|-------------|
| `organization_id` | `uuid` (PK, FK) | References `organizations(id)` |
| `flag_key` | `text` (PK, FK) | References `feature_flags(key)` |
| `enabled` | `boolean` | Override value for this org |
| `set_by` | `uuid` (FK) | Admin who set the override |
| `set_at` | `timestamptz` | When the override was set |

## Registry as Source of Truth

All valid flag keys are defined in `shared/constants/platform-features.ts`. This registry:

- Exports `PLATFORM_FEATURES` — a const object mapping enum-style keys to snake_case DB values
- Exports `PlatformFeatureKey` — the union type of all valid keys
- Exports `isValidFeatureKey()` — a type guard for runtime validation
- Exports `ALL_PLATFORM_FEATURE_KEYS` — array of all valid keys

## Flag Resolution Order

1. Check `organization_feature_flags` for an org-specific override
2. If no override exists, use `feature_flags.default_enabled`
3. If `rollout_percent > 0` and no override, use deterministic hash of `org_id + flag_key` to decide

## Adding a New Flag

1. Add the key to `PLATFORM_FEATURES` in `shared/constants/platform-features.ts`
2. Add a seed entry in `shared/database/seeds/feature-flags.ts`
3. Run the seed script — it is idempotent (`ON CONFLICT ... DO UPDATE`)
4. Use `isValidFeatureKey()` at API boundaries to validate incoming keys

## Audit

Every flag mutation (enable, disable, override) writes to the `audit_log` table with:
- `action`: `feature_flag.enabled`, `feature_flag.disabled`, `feature_flag.override_set`
- `entity_type`: `feature_flag`
- `entity_id`: the flag key
- `metadata`: JSON with old/new values and org context
