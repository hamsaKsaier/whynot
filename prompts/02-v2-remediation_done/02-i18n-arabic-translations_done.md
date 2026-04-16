# 02 — i18n: Arabic (ar) Translations & RTL Verification

## Agent
`translation-manager`

## Skills referenced
- `.claude/skills/backend-i18n/`

## Task

After prompt 01 establishes the canonical English key tree, this prompt produces **native Arabic translations** for every key and verifies RTL rendering end to end. Current Arabic JSON files are mostly empty (e.g. `frontend/public/locales/ar/auth.json` has ~5 2FA-only keys).

**Who speaks**: Modern Standard Arabic (MSA), formal register suitable for a B2B SaaS product. Avoid dialects. Use gender-neutral phrasing where possible. Numbers stay Western (0-9) unless the surrounding UI is Arabic-Indic.

### Scope / Requirements

1. **Translate all frontend keys**
   - For every key under `frontend/public/locales/en/{common,auth,dashboard,runner,results,settings,billing,landing}.json`, produce the Arabic value in `frontend/public/locales/ar/<same-file>.json`.
   - Preserve key structure, ordering, placeholders (`{{userName}}`, `{count, plural, …}`), HTML tags (`<0>`, `<1>`), and escaping.
   - Plurals: use Arabic plural categories (`zero`, `one`, `two`, `few`, `many`, `other`) per CLDR.

2. **Translate all admin-frontend keys**
   - Same treatment for `admin-frontend/public/locales/en/{common,admin,auth,settings,superadmin}.json` → `admin-frontend/public/locales/ar/*.json`.

3. **Verify RTL behavior**
   - Confirm `LanguageSwitcher` flips `document.documentElement.dir = "rtl"` and `lang = "ar"` when Arabic is selected.
   - Every directional icon in the app must have `rtl:scale-x-[-1]` (`ArrowRight`, `ArrowLeft`, `ChevronLeft`, `ChevronRight`, `LogIn`, `LogOut`, `ExternalLink`, `Reply`, `Forward`, `Share`, `Undo`, `Redo`, `SkipBack`, `SkipForward`, `Rewind`, `FastForward`, `MoveLeft`, `MoveRight`). Fix any that don't — this overlaps with prompt 07 but this prompt owns the Arabic verification pass.
   - No `rtl:flex-row-reverse` anywhere (native `dir="rtl"` handles flex reversal per `.claude/rules/rtl-support-arabic.md`).
   - Logical properties (`ms-*`, `me-*`, `ps-*`, `pe-*`, `text-start`, `text-end`, `border-s-*`, `border-e-*`).

4. **Font handling**
   - Verify the system font stack renders Arabic legibly. If not, add a fallback: `"Segoe UI", Tahoma, Arial, "Noto Sans Arabic", sans-serif` via `frontend/src/index.css` scoped to `html[lang="ar"]`.
   - No custom web fonts loaded.

5. **Locale-aware formatting**
   - Dates via `Intl.DateTimeFormat("ar-SA", ...)` — ISO 8601 preserved at the API layer.
   - Numbers via `Intl.NumberFormat("ar-SA", ...)` only in UI; API remains camelCase/numeric.
   - Currency: respect user's org currency; Arabic locale formats `$1,200.50` as `١٬٢٠٠٫٥٠ $` or `1,200.50 US$` depending on `numberingSystem: "latn"`.

### Tests (MANDATORY — 100% coverage)
- **Completeness**: `frontend/src/__tests__/i18n-completeness.test.ts` must pass for `ar` — every en key has a non-empty ar value, and no ar value equals its en value (unless explicitly whitelisted as a proper noun like "whynot", "Stripe", "GitHub").
- **Render test**: for each page-level component, mount with `i18next` set to `ar` and assert the container has `dir="rtl"` and at least one Arabic glyph (`[\u0600-\u06FF]`) in visible text.
- **Icon mirroring**: parse `frontend/src/**/*.tsx` and `admin-frontend/src/**/*.tsx` for directional icons and assert every instance includes `rtl:scale-x-[-1]` in its className. Fail with file:line if missing.
- **No forbidden patterns**: fail on `rtl:flex-row-reverse`, `ml-*`, `mr-*`, `pl-*`, `pr-*`, `text-left`, `text-right` under `src/` (excluding generated, test snapshots, and `node_modules`).
- **Snapshot**: Playwright visual regression at `viewport: { width: 1280, height: 800 }` for login, dashboard, settings, billing — compare `lang=ar` vs `lang=en` to confirm mirrored layout.
- **Pluralization**: assert `{count, plural, ...}` keys render correctly for 0, 1, 2, 3, 11, 100 in Arabic (all six CLDR categories).

### i18n (this prompt's scope — Arabic)
- `frontend/public/locales/ar/*.json` — full coverage.
- `admin-frontend/public/locales/ar/*.json` — full coverage.
- No backend changes in this prompt (backend Arabic JSON is audited in prompt 06). Coordinate with prompt 06 on shared error message terminology.

### Documentation
- `/docs/ar/i18n/how-to-add-a-translation-key.md` — translation of the doc from prompt 01.
- `/docs/ar/index.md` — Arabic landing for the docs site (RTL-ready).

### Constraints
- Docker-only via `make shell-client` and `make shell-admin`.
- Never use Google Translate verbatim — output must be reviewed by someone who reads Arabic. Add a reviewer note to the prompt result.
- No `rtl:flex-row-reverse` anywhere.
- Preserve placeholder syntax exactly; never translate `{{variable}}` names.
- Respect STYLES.md — no style drift.

### Verification steps
1. `make shell-client npm run typecheck && make shell-client npm run lint && make shell-client npm test -- i18n`
2. `make shell-admin npm run typecheck && make shell-admin npm run lint && make shell-admin npm test -- i18n`
3. `make rtl-check` — passes with no physical-directional-class violations.
4. `make start` → open `http://localhost:5183`, switch to Arabic, verify:
   - Every visible string is in Arabic (no English fallthrough)
   - Layout mirrors correctly (sidebar on right, text right-aligned)
   - Directional icons point logically (arrows toward the end, chevrons mirror)
   - Forms submit and error messages come back in Arabic from the backend (requires prompt 06 to land first)
5. Same check on `http://localhost:5184` (admin).
