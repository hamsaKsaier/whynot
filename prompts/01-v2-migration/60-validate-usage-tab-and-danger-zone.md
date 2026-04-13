# Validate: Usage tab + Danger Zone export

## Agent
`design-ui-designer` (verifier) + `api-designer`

## Depends on
`59-usage-tab-ui-and-danger-zone-export.md`

## Goal
Verify UsageTab renders correct aggregates, export produces a complete bundle, and secrets are redacted.

## Validation steps

### 1. Static + unit
- `bun typecheck`, `bun lint` → exit 0
- Component + endpoint tests pass.

### 2. Aggregates correctness
- Seed `usage_events` with known counts/dates.
- Hit `/api/me/usage/summary` and `/api/me/usage/by-day`; assert numbers match the seeded fixture exactly.

### 3. Export bundle
- Trigger export via `POST /api/me/export`; poll until ready; download ZIP.
- Unzip and assert presence of: `profile.json`, `settings.json`, `ai-configs.json` (keys redacted), `test-runs.csv`, `results.csv`, `billing-history.csv`, `usage-events.csv`, `audit-log.csv`.
- Open `ai-configs.json` and assert NO plaintext API key fields.
- Open every CSV; assert valid header row + parseable rows.

### 4. Playwright
- Run a metered action → UsageTab recent events updates within flush interval.
- Charts render in dark + RTL without overflow.
- Trigger export → finish → download → file list correct.

### 5. i18n
- UsageTab in fr + ar; layouts intact, no missing keys.

### 6. Coverage + regression
- 100% on touched files; no regressions.

## Pass criteria
- [ ] Aggregates correct.
- [ ] Export bundle complete and secret-free.
- [ ] Charts render across themes/directions.
- [ ] No regressions.

## On failure
- Re-open `59-usage-tab-ui-and-danger-zone-export.md`; fix; rerun.
- Do NOT advance to phase 11 until this validation passes.
