# WhyNot QA — your self-hosted AI QA team

An open-source platform that puts a **team of specialized AI QA agents** to work
on your web app: they explore it in a real browser, find real bugs, probe your
API and security posture, and write Playwright regression tests — then the QA
Lead compiles everything into one report.

**Self-hosted. Bring your own model key. Your code and staging credentials never
leave your network.**

<!--
  DEMO: add docs/demo.gif (or an MP4, see below), then delete the two comment
  markers around the block below to make it live. Kept commented so the public
  README never shows a broken image before the asset exists.

  GIF option (simplest — always renders, autoplays, loops):
<p align="center">
  <a href="#quickstart-15-minutes">
    <img src="docs/demo.gif"
         alt="WhyNot QA team board — five AI agents testing a web app live, with the Security agent submitting SQL injection payloads"
         width="820">
  </a>
</p>
<p align="center">
  <em>Point it at a URL &rarr; five agents test it live &rarr; real bugs, with reproduction steps.</em>
</p>

  MP4 option (sharper, smaller): drag the .mp4 into any GitHub issue/PR comment,
  copy the https://github.com/user-attachments/assets/... URL it generates, and
  paste that URL on its own line here — GitHub renders it as an inline player.
-->

## Why not just paste screenshots into a chatbot?

A chatbot answers a question and forgets you. WhyNot runs a **workflow**:

- **A real QA team, not one generalist.** Five agents with distinct roles work
  in parallel and talk to each other — the Lead sets strategy, the Exploratory
  tester wanders your UI, the Security tester pokes where it shouldn't, the API
  tester hunts edge cases, and the Auto tester turns confirmed bugs into
  Playwright regression tests.
- **Memory.** Projects, bug history, and test suites persist. Every scan makes
  the next one smarter.
- **Privacy.** Runs entirely on your infrastructure with a single
  `docker compose up`. No vendor cloud in the loop — usable where a cloud
  chatbot never will be (banks, healthcare, government, EU data residency).
- **Model-agnostic.** New model released this week? It's a dropdown entry in
  your admin panel, not a migration.

## Quickstart (~15 minutes)

Requirements: Docker + Docker Compose, ~4 GB free RAM, and **one** LLM API key
(Anthropic, OpenAI, Google, or any OpenRouter model).

```bash
git clone https://github.com/hamsaKsaier/whynot.git && cd whynot
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
# or ANTHROPIC_API_KEY=... / OPENAI_API_KEY=... / OPENROUTER_API_KEY=...

# Required secrets — generate each with: openssl rand -base64 32
JWT_SECRET=<generated>
SECRETS_ENCRYPTION_KEY=<generated, exactly 32 bytes>
```

```bash
docker compose -f docker/compose/docker-compose.yml up --build
```

Then open:

- **App** → http://localhost:5183 — sign in with your admin email/password
- **Admin** → http://localhost:5184 → **AI Providers** → confirm your key, pick a model

Point a scan at a URL and watch the QA team work.

Full guide, edition-flag details, and troubleshooting: **[docs/SELF_HOSTING.md](docs/SELF_HOSTING.md)**

## Run scans for free

WhyNot runs a full scan on **Google AI Studio's free tier** — no card, no spend.
Grab a key at [aistudio.google.com](https://aistudio.google.com) and set:

```bash
GOOGLE_AI_API_KEY=<your free key>
GOOGLE_AI_MODEL=gemini-flash-lite-latest
```

That second line matters. Free-tier request limits differ sharply between
models: the full `flash` models allow as few as **5 requests per minute**, and a
single scan makes far more calls than that. Scans still complete — WhyNot backs
off and retries when a provider rate-limits it — but they crawl. The `flash-lite`
alias has much higher limits and is what we test the free path against.

> **Use the `-latest` aliases, not pinned model IDs.** Google retires specific
> versions for *new* API keys while existing keys keep working, so a pinned ID
> like `gemini-2.5-flash` fails with "no longer available to new users" on a
> fresh install. The aliases always resolve to the current model.

If you'd rather pay a little for a faster, sharper scan, a full 5-agent run on
Gemini 2.5 Flash via OpenRouter costs roughly **2–3 cents**.

## Supported models

WhyNot is model-agnostic — the admin panel picks the provider and model, so a
new model release is a config change, not a code change.

| Provider | Status |
|----------|--------|
| Google (Gemini) | **Verified** — free tier completes scans; use `gemini-flash-lite-latest` |
| OpenRouter (Gemini, Qwen, GLM, DeepSeek, …) | **Verified** on Gemini 2.5 Flash; other models untested |
| Anthropic (Claude) | **Verified** |
| OpenAI | Supported in code, not yet verified |
| Z.ai (GLM) | Supported in code, not yet verified |

A caveat worth knowing: several **free** models advertised as supporting tool
calling fail partway through a scan — they handle single calls but not the long
multi-step tool loops the agents need. If a scan dies with JSON or provider
errors, try a different model before assuming WhyNot is broken.

Running a model we haven't listed? Tell us how it went — open a `[model-report]`
issue (see [CONTRIBUTING.md](CONTRIBUTING.md)) and we'll add it to this table.

## Architecture

Microservices orchestrated with Docker Compose:

| Service | Role |
|---------|------|
| `frontend` | Dashboard — projects, scans, bugs, test suites |
| `admin-frontend` | Control plane — AI providers, model selection, settings |
| `gateway` | API gateway, auth, orchestration |
| `services/qa-loop-executor` | The agent team — browser-driving QA agents (MCP + Playwright) |
| `services/test-executor` | Playwright test execution |
| `services/ai-service` | Test generation & vision analysis |
| `database` | PostgreSQL |

More docs: [API](docs/API.md) · [Deployment](docs/DEPLOYMENT.md) ·
[Troubleshooting](docs/TROUBLESHOOTING.md)

## Contributing

Contributions welcome — see [CONTRIBUTING.md](CONTRIBUTING.md). Commits require
a DCO sign-off (`git commit -s`).

## Hosted edition

The self-hosted edition is free and will stay free. A hosted version (same
codebase, we run it for you) is planned — open an issue if you'd want that.

## License

[AGPL-3.0](LICENSE) © 2026 Hamza Ksaier and contributors.

If you run a modified version of WhyNot as a network service, the AGPL requires
you to make your modified source available to its users.
