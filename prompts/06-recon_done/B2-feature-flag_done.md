# Recon — Add the `recon_enabled` feature flag

## Agent
`recon-engineer` (A1).

## Skills
- Primary: `.claude/skills/spec-driven-development/`
- Rules: `.claude/rules/recon-safety.md` (A7)

## Dependencies
- A1, A7

## Task
Add a single master feature flag for Recon, default-on, surfaced in both the backend feature-flag system and the frontend `useFeatureFlag` hook.

### 1. Files to modify
- `shared/constants/platform-features.ts` — add `RECON_ENABLED = 'recon_enabled'` to the `PLATFORM_FEATURES` enum (or whatever the canonical declaration shape is — match existing entries like `AI_MULTI_PROVIDER`, `PAYG_BILLING`, `LANGUAGE_SWITCHER`).
- `gateway/shared/database/seeds/feature-flags.ts` (or the actual seed file location — `find shared -name 'feature-flags*'`) — add a seed row:
  ```ts
  { key: 'recon_enabled', default_enabled: true, rollout_percent: 100, description: 'Recon AI pentester' }
  ```
- `gateway/src/utils/feature-flags.ts` — no code changes if the lookup uses the enum, but ADD a unit test asserting `isFlagEnabled(orgId, 'recon_enabled')` returns true by default.
- `frontend/src/providers/FeatureFlagsProvider.tsx` — verify it picks up new flags via `/me/flags` polling. No code change expected; add an integration test asserting the new flag appears.

### 2. Single-flag discipline
This is the ONLY Recon feature flag for v1. Per `.claude/rules/recon-safety.md` rule #7, do NOT introduce per-phase or per-vuln-class flags.

### Tests
- Backend unit test: `isFlagEnabled('any-org-id', 'recon_enabled')` returns `true` when the seed has run.
- Backend unit test: `isFlagEnabled('any-org-id', 'recon_enabled')` returns `false` if a per-org override sets it to false.
- Backend unit test: `requireFlag('recon_enabled')` middleware rejects with 404 (NOT 403 — flag-off should be indistinguishable from "feature doesn't exist") when the flag is disabled for the org.
- Frontend hook test: `useFeatureFlag('recon_enabled')` returns true after `FeatureFlagsProvider` resolves.
- 100% coverage on changed files.

### i18n
- No new user-facing strings — flag is internal. (UI labels for the Recon nav item live in D1.)

### Documentation
- N/A.

### Files to modify
- `shared/constants/platform-features.ts`
- `gateway/shared/database/seeds/feature-flags.ts` (or equivalent)
- Tests for both
