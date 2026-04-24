# Recon — In-app announcement + changelog

## Agent
`frontend-developer` (`.claude/agents/frontend-developer.md`); copy reviewed by `translation-manager` (`.claude/agents/translation-manager.md`).

## Skills
- Primary: `.claude/skills/copywriting/`, `.claude/skills/landing-page-optimization/`
- Supporting: `.claude/skills/popup-cro/` (for the announcement banner UX)
- Rules: `.claude/rules/recon-safety.md` (A7), `.claude/rules/uncodixify-ui.md`, `.claude/rules/rtl-support-arabic.md`

## Dependencies
- All of A–F.

## Task
Announce Recon to existing workspaces with a one-time in-app banner + changelog entry, in all 5 languages, without using banned vocabulary.

### 1. In-app banner
- File: `frontend/src/components/announcements/ReconAnnouncementBanner.tsx`
- Mounts inside the existing announcements slot (find via `grep -r 'AnnouncementBanner\|FeatureAnnouncement' frontend/src/`).
- Renders ONLY when:
  - `useFeatureFlag('recon_enabled')` returns true
  - `localStorage.getItem('recon.announcement.dismissed')` is null OR dismissed-date is older than 30 days
  - User has not yet visited `/recon` (track via a per-user `seen_recon` flag on the user record; if no such field, add a new gateway endpoint `POST /api/users/me/seen-features` and a `seen_recon` boolean column on `users`).
- Layout: short headline + 1-line subhead + "Try Recon" primary button + dismiss icon.
- No animation beyond a `transition-opacity duration-150` on dismiss.
- RTL: dismiss icon on the end side.
- Banned vocab: NONE.

### 2. Changelog entry
- File: changelog page in the docs (E3 area). Or in-app `/changelog` if the project has one — find via `grep -r 'changelog\|Changelog' frontend/src/`.
- Entry shape (copy in en, then translated):
  - Date
  - Title: "Introducing Recon — pentest every release"
  - Body: 2–3 paragraphs describing the value prop. Mirror the landing-page benefit triad.
  - "Try it now" link → `/recon`.

### 3. Email announcement (optional)
If the project has a transactional-email system (find via `grep -r 'sendEmail\|emailService' gateway/src/`), draft a one-time broadcast template `recon-announcement-{lang}.html` for marketing to schedule. Do NOT auto-send from this prompt.

### Tests
- Banner renders when conditions met.
- Banner hidden when flag off, or when dismissed within last 30 days, or when user has already visited `/recon`.
- Dismiss writes to `localStorage` with the dismissed-date.
- 30 days later (mock Date.now), banner re-appears (if still flagged + not visited).
- Visiting `/recon` once marks `seen_recon=true` and the banner disappears.
- Snapshot in en + ar.
- Banned-vocab grep on the rendered HTML returns no matches.
- 100% coverage on new files.

### i18n
- `frontend/public/locales/{en,ar,fr,de,es}/announcements.json` (new namespace if not present):
  - `announcements.recon.headline` — "Recon is here."
  - `announcements.recon.subheadline` — "Run an autonomous pentest against your app — only proven exploits are reported."
  - `announcements.recon.cta` — "Try Recon"
  - `announcements.recon.dismiss` — "Dismiss"
- Changelog page entry in 5 langs (managed in E3-style docs files).
- Email templates in 5 langs if applicable.

### Documentation
- E3's changelog is updated by this prompt's changelog entry.

### Files to modify
- See file list in section 1.
- 5 frontend `announcements.json` locale files.
- Changelog markdown files (5 langs).
- Optional: email templates.
- Optional: gateway endpoint + migration for the `seen_recon` user field if not present.
- Tests.
