# Self-hosting WhyNot QA

Run WhyNot QA on your own infrastructure. Your app, your code, and your LLM
API key never leave your network — there's no WhyNot cloud in the loop.

This is the **open-source, self-hosted edition**: no billing, no plan limits,
a single admin account, bring your own model key.

---

## Requirements

- Docker + Docker Compose
- One LLM provider API key (Anthropic, OpenAI, Google, or any OpenRouter model
  such as Qwen or GLM)
- ~4 GB free RAM for the browser-driving agents

---

## Quickstart

```bash
# 1. Clone
git clone <your-repo-url> whynot && cd whynot

# 2. Configure
cp .env.example .env
```

Edit `.env` and set, at minimum:

```bash
SELF_HOSTED=true
ADMIN_EMAIL=you@example.com
ADMIN_PASSWORD=<a strong password>

# Pick ONE provider key. Google's free tier is the zero-cost path:
GOOGLE_AI_API_KEY=<free key from aistudio.google.com>
GOOGLE_AI_MODEL=gemini-flash-lite-latest
# or ANTHROPIC_API_KEY=...  / OPENAI_API_KEY=...  / OPENROUTER_API_KEY=...
#
# Use the `-latest` aliases, not pinned IDs like `gemini-2.5-flash` — Google
# retires specific versions for NEW API keys, so a pinned default fails on a
# fresh install with "no longer available to new users".

# Required secrets — generate each with: openssl rand -base64 32
JWT_SECRET=<generated>
SECRETS_ENCRYPTION_KEY=<generated, exactly 32 bytes>
```

```bash
# 3. Run
docker compose -f docker/compose/docker-compose.yml up --build
```

Then open:

- **App** → http://localhost:5183  (sign in with your `ADMIN_EMAIL` / `ADMIN_PASSWORD`)
- **Admin** → http://localhost:5184  → **AI Providers** → confirm your key, pick a model

Start a scan, point it at a URL, and watch the QA team work.

---

## How the edition flag works

`SELF_HOSTED=true` does three things:

1. **No billing** — the Stripe webhook, `/api/billing/*`, and `/api/plans`
   endpoints are not mounted; subscription, credit, and feature gates all
   pass through.
2. **Single admin** — public sign-up is disabled. The one admin account is
   created on first boot from `ADMIN_EMAIL` / `ADMIN_PASSWORD` (and gets a
   workspace automatically, so you can scan immediately).
3. **Bring your own key** — model selection is driven entirely by the admin
   **AI Providers** page. Keys are stored encrypted in your own database.

### `AUTH_DISABLED`

For running locally on a trusted machine you can set `AUTH_DISABLED=true` to
skip the login screen (auto-authenticated as the admin). **Never enable this
on a server reachable from the internet.**

---

## License

WhyNot QA is licensed under **AGPL-3.0**. The full license text must be present
in the repository as `LICENSE`. If it's missing, add it:

```bash
curl -o LICENSE https://www.gnu.org/licenses/agpl-3.0.txt
```

Under AGPL-3.0, if you run a modified version as a network service, you must
make your modified source available to its users.

---

## Troubleshooting

- **Can't log in / "login impossible" in the logs** — `SELF_HOSTED=true` but
  `ADMIN_EMAIL` / `ADMIN_PASSWORD` weren't set. Set them and restart.
- **Scans fail with a provider error** — no key set, or the model picked in the
  admin UI doesn't match your provider. Check **Admin → AI Providers → Test
  connection**.
- **`SECRETS_ENCRYPTION_KEY must be exactly 32 bytes`** — regenerate with
  `openssl rand -base64 32`.
