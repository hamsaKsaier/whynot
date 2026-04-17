# Fix Mixed-Language Output on the Performance Page

## Agent
`.claude/agents/frontend-developer.md` — primary implementer.
`.claude/agents/translation-manager.md` — consult for key naming and copy review.

## Skills
`.claude/skills/backend-i18n/` — reference if any server-side message surfaces during this work.
`.claude/skills/shadcn-design-system-compliance` and `.claude/rules/rtl-support-arabic.md` — must continue to pass.
`.claude/rules/spec-driven-development.md` — Docker-only execution.

## Task

Smoke test at `https://whynot.skrum.io/performance` with Arabic selected shows a mixed-language page: chrome is Arabic but several strings remain in English. Eliminate every English leak on `/performance` in all 5 supported locales (`en`, `ar`, `fr`, `de`, `es`). Verdict text stays client-side — localize via `t()` interpolation, **do not** change the gateway API contract.

### 1. Client-derived narrative (the biggest leak)
- Rewrite `getVerdict()` in `frontend/src/components/Performance/ResultsDashboard.tsx` (approximately lines 30–150) so every branch returns a translated string via `t('runner:performance.verdict.<branchKey>', { rps, avgMs, p95, p99, errorPct, unexpectedPct })`.
- Cover every observed branch: "Your API handles X req/s with Yms average response time — looking good!", "X% of requests returned an unexpected status — your API is failing under load.", "95% of requests take over Xs — users will experience timeouts. Optimize your API or add caching.", "Occasional spikes up to Xms — some users will experience very slow responses.", plus every other branch currently present.
- Use ICU plurals where the English source pluralizes ("1 request" vs "21 requests"); react-i18next supports `count` natively.
- Every bullet analysis line ("Average response time: 354ms — well within acceptable range.", "21 requests — 52% returned the expected status.") must also come from `runner:performance.verdict.bullet.*` keys.

### 2. Static labels
- Test type buttons — `TestConfig.tsx` currently hardcodes `Smoke | Load | Stress | Spike`. Add `runner:performance.testType.{smoke,load,stress,spike}` and use them for button labels, tab triggers, and the test description subtitle ("Quick validation — 1 user, 30 seconds" and equivalents for load/stress/spike).
- HTTP methods — `TestConfig.tsx` method dropdown options `GET/POST/PUT/PATCH/DELETE` must come from `runner:performance.httpMethod.{get,post,put,patch,delete}`.
- Footer — `frontend/src/components/layout/Footer.tsx` currently shows `Docs`, `Status`, `WhyNot QA v{appVersion}`. Use `common:footer.docs`, `common:footer.status`, `common:footer.appVersion` (where appVersion interpolates `{{version}}`).
- Credit badge — find the component rendering `10 رصيد` (likely `frontend/src/components/Billing/CreditUsageBar.tsx` or equivalent). Replace the partial-translation split with a single key `billing:credits.balance` whose value is `"{{count}} credits"` / `"{{count}} رصيد"` / etc., using ICU plurals.
- Prior runs list — `smoke Test`, `21 req`, `354ms avg` must come from the same testType keys plus `runner:performance.prior.{requestCount,avgMs}` with interpolation.

### 3. Chart axis units
- `ResponseTimeChart.tsx`, `RPSChart.tsx`, `VirtualUsersChart.tsx` each pass `label={{ value: 'ms' | 'req/s' | 'VUs' }}` to Recharts `XAxis`/`YAxis`. Replace with `t('runner:performance.chart.unit.ms')`, `…rps`, `…vus`.
- Chart legend (`p50 p95 p99`) — move to `runner:performance.chart.legend.{p50,p95,p99}`.
- Tooltip formatters must also call `t()`.

### 4. Locale-aware date formatting
- `CompareRuns.tsx` calls `new Date(...).toLocaleString('en-US')`. Replace with `toLocaleString(i18n.language)` (import `useTranslation` to access `i18n`). Confirm Arabic renders with Arabic-Indic digits only if that's current UX; otherwise pass `{ numberingSystem: 'latn' }`.
- Same fix in any other performance component that formats dates.

### 5. Translation files
Add the new keys to all 5 files in each namespace touched:
- `frontend/public/locales/{en,ar,fr,de,es}/runner.json` — performance.verdict.*, performance.testType.*, performance.httpMethod.*, performance.chart.*, performance.prior.*
- `frontend/public/locales/{en,ar,fr,de,es}/common.json` — footer.*
- `frontend/public/locales/{en,ar,fr,de,es}/billing.json` — credits.balance (if not already present)

Maintain the quality rules enforced by `frontend/src/__tests__/i18n-completeness.test.ts`:
- French: NBSP before `:`, `!`, `?`, `;`
- Spanish: matching `¿…?` and `¡…!` pairs
- German: language markers where the existing test expects them
- All placeholders (`{{rps}}`, `{{avgMs}}`, etc.) preserved across every language file.

### Tests
All tests run in Docker: `make test-frontend` (never raw `npm test`).

- `frontend/src/components/Performance/__tests__/ResultsDashboard.test.tsx`
  - For each of the 5 languages, seed a summary payload for every verdict branch (ok, high-error, high-p95, spiky-p99, etc.) and assert `screen.getByText(...)` matches the localized string.
  - Snapshot each branch × each language (25+ snapshots) to lock copy.
  - Edge cases: 0 requests, 100% error rate, sub-ms latency, >10s p99, `null`/`undefined` fields.
- `frontend/src/components/Performance/__tests__/TestConfig.test.tsx`
  - For each language, assert test-type buttons, method dropdown options, and subtitle strings all render from the runner namespace.
  - Edge case: when `runner.performance.testType.smoke` is missing, test fails (forces parity).
- `frontend/src/components/Performance/__tests__/CompareRuns.test.tsx`
  - Mount with each language, assert date strings match `Intl.DateTimeFormat(lang).format(date)` for a fixed timestamp.
- `frontend/src/components/Performance/__tests__/charts-i18n.test.tsx`
  - Assert axis label and tooltip strings in each language for each chart.
- `frontend/src/components/Billing/__tests__/CreditUsageBar.test.tsx`
  - Plural tests: 0, 1, 2, 10, 100 credits × 5 languages.
- `frontend/src/components/layout/__tests__/Footer.test.tsx`
  - Footer shows localized `Docs`/`Status`/`WhyNot QA v1.2.3` per language.
- Regression: `frontend/src/__tests__/i18n-completeness.test.ts` and `frontend/src/__tests__/i18n-no-hardcoded-strings.test.ts` must stay green. Extend the no-hardcoded-strings scanner's include list to cover `src/components/Performance/**`.
- Coverage threshold stays at 100% (Vitest v8 config in `frontend/vitest.config.ts`).

### i18n
- New keys:
  - `runner:performance.verdict.{headline,bullet.*}` — use descriptive sub-keys per branch (`okLatency`, `highErrorRate`, `slowP95`, `spikyP99`, etc.).
  - `runner:performance.testType.{smoke,load,stress,spike}` plus matching `…Description`.
  - `runner:performance.httpMethod.{get,post,put,patch,delete}`.
  - `runner:performance.chart.unit.{ms,rps,vus}` and `runner:performance.chart.legend.{p50,p95,p99}`.
  - `runner:performance.prior.{requestCount,avgMs,requestCount_plural}` — ICU plurals.
  - `common:footer.{docs,status,appVersion}`.
  - `billing:credits.balance` — with `count` pluralization.
- RTL considerations:
  - Arabic strings must contain no Latin-only sentences outside the brand allowlist (`WhyNot QA`, product names).
  - Any inline em-dash / en-dash copy should use appropriate punctuation per language.
  - Chart axis `label` in Recharts does not auto-flip in RTL; if directionality looks wrong after localization, set `label={{ value: t(...), position: 'insideStart' }}` or rely on default because the chart area is LTR by nature (numbers flow left-to-right even in Arabic UIs).
  - Verify on `http://localhost:5173/performance?lng=ar` after change that the whole page is Arabic.
- Docker validation: `make shell-client npm run rtl:check` (or `make rtl-check`).

### Documentation
Create or update, for **each of the 5 languages**:
- `/docs/{en,ar,es,fr,de}/testing/performance.md` — add a "Localization" subsection describing that verdict copy is localized client-side with interpolated metrics. Mirror the same headings across all 5 files.
- `/docs/{en,ar,es,fr,de}/i18n.md` — add an "Adding new keys to runner namespace" short note pointing at this prompt's new keys as an example.

### Verification (manual + automated)

```bash
make shell-client npm run lint
make test-frontend
make shell-client npm run typecheck
# manual smoke
make start
# visit http://localhost:5173/performance?lng=ar, run a smoke test, confirm the verdict and all labels are in Arabic
# repeat for ?lng=fr, ?lng=de, ?lng=es
```

Acceptance criteria (definition of done):
- [ ] No English strings visible on `/performance` when any non-English locale is active.
- [ ] All Vitest tests pass at 100% coverage.
- [ ] `i18n-completeness.test.ts` and `i18n-no-hardcoded-strings.test.ts` pass.
- [ ] `make rtl-check` passes.
- [ ] Playwright `language-switcher.spec.ts` still green.
- [ ] `/docs/{en,ar,es,fr,de}/testing/performance.md` updated in all 5 languages.
