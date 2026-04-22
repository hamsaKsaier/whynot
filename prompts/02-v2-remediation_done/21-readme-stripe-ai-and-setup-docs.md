# 21 — README + Setup Docs: Stripe, AI Providers, Superadmin, Deployment

## Agent
`api-designer`

## Skills referenced
- `.claude/agents/content/blog-developer.md` (for docs writing style)
- `.claude/skills/spec-driven-development/`

## Task

README.md currently mentions "add your OpenAI or Anthropic API key" in a single line and has no Stripe setup, no superadmin walkthrough, no webhook CLI instructions. Rewrite the relevant sections so a new developer or operator can set up the full stack end to end. Mirror the same content into `/docs/{en,ar,fr,de,es}/**` for 5-language docs coverage.

### Scope / Requirements

1. **README.md restructure**
   - Keep existing non-setup sections intact (architecture overview, contributing, license).
   - Add or rewrite these sections:
     - **Prerequisites** — Docker, Docker Compose, Node 20+, Git, a domain + DNS for production, a Stripe account (test mode is free), an Anthropic or OpenAI API key.
     - **Quick start (development)** — clone, copy `.env.example` → `.env`, fill in minimum required vars, `make start`, visit `http://localhost:5183`.
     - **Environment variables** — link to `/docs/en/deployment/environment-variables.md` (from prompt 20). Include a compact table with just the minimum required vars.
     - **Stripe setup** — full walkthrough:
       1. Create a Stripe account (or use existing).
       2. Enable test mode in the dashboard.
       3. Create products in `Products`: `whynot Starter`, `Pro`, `Business`, `Enterprise`, `PAYG metered`.
       4. For each product, create a recurring price (monthly, yearly where applicable) and a one-time price if needed.
       5. Copy each price ID (`price_...`) to the corresponding `STRIPE_PRICE_*` var in `.env`.
       6. Copy the secret key (`sk_test_...`) → `STRIPE_SECRET_KEY`.
       7. Copy the publishable key (`pk_test_...`) → `STRIPE_PUBLISHABLE_KEY` and `VITE_STRIPE_PUBLISHABLE_KEY`.
       8. Create a webhook endpoint:
          - Production: `https://superadmin.whynot.skrum.io/api/webhooks/stripe` (or your own domain).
          - Development: use `stripe listen --forward-to localhost:3010/api/webhooks/stripe`; copy the signing secret printed by the CLI.
          - Copy the webhook signing secret → `STRIPE_WEBHOOK_SECRET`.
       9. Select events to listen to: `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.paid`, `invoice.payment_failed`, `charge.refunded`, `charge.dispute.created`, `payment_intent.succeeded`, `payment_intent.payment_failed`.
       10. Test the flow with `4242 4242 4242 4242` (success), `4000 0000 0000 0341` (decline after attach), `4000 0025 0000 3155` (3DS required).
       11. Go live: switch test mode → live mode, repeat steps 3-9 with live keys and live webhook URL.
     - **AI provider setup**:
       - Anthropic: create an account at `console.anthropic.com`, generate an API key, set `LLM_PROVIDER=anthropic` and `ANTHROPIC_API_KEY=sk-ant-...`. Recommended model: `claude-opus-4-6` or `claude-sonnet-4-6`.
       - OpenAI: create an account at `platform.openai.com`, generate an API key, set `LLM_PROVIDER=openai` and `OPENAI_API_KEY=sk-...`. Recommended model: `gpt-4o`.
       - Configure fallback provider (optional): if the primary provider fails, the factory falls back to the secondary.
       - Cost controls: set `AI_MAX_TOKENS` and `AI_TEMPERATURE` as needed.
     - **Superadmin setup**:
       1. Run migrations: `make migrate`.
       2. Seed the first super_admin user: `make shell-gateway node scripts/seed-superadmin.js --email admin@example.com --password <strong-password>` (script must exist; create if missing and document here).
       3. Sign in at `https://admin.whynot.skrum.io` or `https://superadmin.whynot.skrum.io` (see nginx setup below).
     - **Nginx setup** — point to `/docs/en/deployment/nginx-setup.md` (from prompt 18) with a compact summary:
       - Symlink `docker/nginx/whynot.skrum.io` into `/etc/nginx/sites-available/`.
       - `sudo nginx -t && sudo systemctl reload nginx`.
       - `sudo certbot --nginx -d whynot.skrum.io -d admin.whynot.skrum.io -d superadmin.whynot.skrum.io`.
     - **DNS** — A/AAAA records for all three hostnames pointing to your server.
     - **Running tests** — `make test`, `make test-e2e`.
     - **Deployment** — link to `/docs/en/deployment/**` pages.
     - **Troubleshooting** — link to `/docs/en/deployment/troubleshooting.md`.

2. **Docs pages**
   - Create/update in 5 languages (`en`, `ar`, `fr`, `de`, `es`):
     - `/docs/{lang}/payments/stripe-setup.md` (owned by prompt 19 but mirror the walkthrough here if needed)
     - `/docs/{lang}/payments/troubleshooting.md`
     - `/docs/{lang}/ai/provider-setup.md`
     - `/docs/{lang}/ai/cost-controls.md`
     - `/docs/{lang}/admin/superadmin/setup.md`
     - `/docs/{lang}/admin/superadmin/first-user.md`
     - `/docs/{lang}/deployment/quick-start.md`
     - `/docs/{lang}/deployment/environment-variables.md` (owned by prompt 20 but ensure link from README)
     - `/docs/{lang}/deployment/nginx-setup.md` (owned by prompt 18)
     - `/docs/{lang}/deployment/secrets.md` (owned by prompt 20)
     - `/docs/{lang}/deployment/troubleshooting.md`
     - `/docs/{lang}/index.md` (docs landing page listing all sections)
   - Translations must be human-reviewed, not machine-translated verbatim.

3. **Cross-linking**
   - README links to `/docs/en/*` for detail.
   - Every `/docs/{lang}/*` page has a language switcher at the top (links to `/docs/{other-lang}/same-path.md`).
   - RTL-friendly for Arabic docs (if the docs site is rendered through the frontend's markdown renderer, ensure `dir="rtl"` applies when `lang=ar`).

4. **README style**
   - Concise, scannable, action-oriented.
   - Code blocks tagged with language (`bash`, `typescript`, `json`).
   - No marketing fluff.
   - No emojis (per project rules) unless already present.

### Tests (MANDATORY — 100% coverage where applicable)
- **Link check**: CI script that crawls README.md and all `/docs/**/*.md` files and asserts every internal link resolves. Fails on broken links.
- **Language consistency**: script asserts every `en` doc has a counterpart in `ar`, `fr`, `de`, `es`.
- **Code block syntax**: lint every code block; bash blocks must be valid shell; json blocks must parse.
- **Smoke test**: a new developer following only the README can reach `make start` and see the landing page. Document this as a manual check; no automation required.

### i18n (5 languages)
- All docs content translated to ar/fr/de/es.
- Stripe/AI/superadmin terminology consistent with glossaries from prompts 02-05.
- README.md itself stays in English; document translations go under `/docs/{lang}/`.

### Documentation
- This prompt IS the documentation prompt — the entire scope is doc creation.

### Constraints
- Docker-only instructions throughout — never recommend direct `npm` or `node` calls.
- No secrets committed; `.env.example` with placeholders only.
- Every instruction must be reproducible on a fresh clone.
- Respect `.claude/rules/spec-driven-development.md` — treat this as a content deliverable with review gates.
- No broken links, no placeholder `TODO` markers in published docs.

### Verification steps
1. `make shell-client npm run docs:linkcheck` (or equivalent — create the script if missing).
2. Manual: a volunteer follows README from scratch on a clean machine and reaches a working local stack. Note any friction in a follow-up.
3. Visit `/docs` via the frontend (if served) and verify all 5 language variants render.
4. `grep -rEn "TODO|FIXME|XXX" README.md docs/` returns zero hits.
5. Every internal link resolves, every code block is syntactically valid.
