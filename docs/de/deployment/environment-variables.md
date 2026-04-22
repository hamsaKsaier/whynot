---
title: "Referenz der Umgebungsvariablen"
description: "Vollstaendige Referenz aller Umgebungsvariablen der WhyNot-Plattform."
lang: de
draft: true
---

# Referenz der Umgebungsvariablen

Dieses Dokument ist die massgebliche Referenz fuer alle Umgebungsvariablen, die von der WhyNot-Plattform verwendet werden.

## Schnellstart

```bash
cp .env.example .env
# Edit .env and fill in REQUIRED values
# Then: make start
```

## Konfigurationsarchitektur

- **Gateway** — wird beim Start ueber ein Zod-Schema in `gateway/src/config/env.ts` validiert. Fehlende erforderliche Variablen fuehren zu einem sofortigen Abbruch mit einer klaren Fehlermeldung.
- **Frontend** — Build-Zeit-Variablen mit dem Praefix `VITE_` werden in das JS-Bundle eingebettet. Zentralisiert in `frontend/src/config.ts`.
- **Admin-Frontend** — gleiches Muster, zentralisiert in `admin-frontend/src/config.ts`.
- **Dienste** (test-executor, qa-loop-executor) — lesen `process.env` direkt; Docker Compose uebergibt Variablen ueber `environment:` oder `env_file:`.

## Variablenreferenz

### Datenbank

| Variable | Erforderlich | Standard | Verwendet von | Beschreibung |
|----------|----------|---------|---------|-------------|
| `DATABASE_URL` | Nein | _(aus POSTGRES_* zusammengesetzt)_ | gateway, services | Vollstaendiger PostgreSQL-Verbindungsstring. Ueberschreibt einzelne Variablen. |
| `POSTGRES_USER` | Nein | `whynot` | gateway, services, Docker | Datenbankbenutzer |
| `POSTGRES_PASSWORD` | Nein | `whynot` | gateway, services, Docker | Datenbankpasswort (**in Produktion aendern**) |
| `POSTGRES_DB` | Nein | `whynot` | gateway, services, Docker | Datenbankname |
| `POSTGRES_HOST` | Nein | `database` | gateway | Hostname (Docker-Dienstname in Containern) |
| `POSTGRES_PORT` | Nein | `5433` | Docker | **Host**-Port fuer PostgreSQL |

### Authentifizierung

| Variable | Erforderlich | Standard | Verwendet von | Beschreibung |
|----------|----------|---------|---------|-------------|
| `JWT_SECRET` | **Ja** | — | gateway | Token-Signaturschluessel. Generieren: `openssl rand -base64 64` |
| `GITHUB_CLIENT_ID` | Fuer GitHub-Login | — | gateway | GitHub OAuth-App Client-ID |
| `GITHUB_CLIENT_SECRET` | Fuer GitHub-Login | — | gateway | GitHub OAuth-App Client-Secret |
| `GITHUB_CALLBACK_URL` | Nein | `http://localhost:3010/api/auth/github/callback` | gateway | OAuth-Callback-URL |
| `GOOGLE_CLIENT_ID` | Fuer Google-Login | — | gateway | Google OAuth Client-ID |
| `GOOGLE_CLIENT_SECRET` | Fuer Google-Login | — | gateway | Google OAuth Client-Secret |
| `GOOGLE_CALLBACK_URL` | Nein | `http://localhost:3010/api/auth/google/callback` | gateway | OAuth-Callback-URL |

### Verschluesselung

| Variable | Erforderlich | Standard | Verwendet von | Beschreibung |
|----------|----------|---------|---------|-------------|
| `SECRETS_ENCRYPTION_KEY` | **Ja** (fuer Secrets) | — | gateway | AES-256-Schluessel, 32 Bytes Base64. Generieren: `openssl rand -base64 32` |
| `ENCRYPTION_KEY` | **Ja** (fuer Integrationen) | — | gateway | Verschluesselungsschluessel fuer Integrations-Token |

### Stripe-Abrechnung

| Variable | Erforderlich | Standard | Verwendet von | Beschreibung |
|----------|----------|---------|---------|-------------|
| `STRIPE_SECRET_KEY` | Fuer Zahlungen | — | gateway | Stripe-API-Secret-Key |
| `STRIPE_PUBLISHABLE_KEY` | Fuer Zahlungen | — | gateway | Oeffentlicher Stripe-Schluessel |
| `STRIPE_WEBHOOK_SECRET` | Fuer Zahlungen | — | gateway | Stripe-Webhook-Signaturschluessel |
| `STRIPE_SUCCESS_URL` | Nein | `http://localhost:5183/billing?success=true` | gateway | Checkout-Erfolgs-Weiterleitung |
| `STRIPE_CANCEL_URL` | Nein | `http://localhost:5183/billing?canceled=true` | gateway | Checkout-Abbruch-Weiterleitung |
| `STRIPE_PRICE_*` | Nein | — | gateway | Stripe-Preis-IDs fuer jede Planstufe |

### KI-Anbieter

| Variable | Erforderlich | Standard | Verwendet von | Beschreibung |
|----------|----------|---------|---------|-------------|
| `LLM_PROVIDER` | Nein | `anthropic` | ai-service | KI-Anbieter: `anthropic` oder `openai` |
| `ANTHROPIC_API_KEY` | Wenn provider=anthropic | — | gateway, ai-service | Anthropic-API-Schluessel |
| `ANTHROPIC_MODEL` | Nein | `claude-sonnet-4-6` | ai-service | Anthropic-Modell-ID |
| `OPENAI_API_KEY` | Wenn provider=openai | — | ai-service | OpenAI-API-Schluessel |
| `OPENAI_MODEL` | Nein | `gpt-4` | ai-service | OpenAI-Modell-ID |
| `OPENAI_VISION_MODEL` | Nein | `gpt-4o` | ai-service | OpenAI-Vision-Modell |

### E-Mail

| Variable | Erforderlich | Standard | Verwendet von | Beschreibung |
|----------|----------|---------|---------|-------------|
| `RESEND_API_KEY` | Nein | — | gateway | Resend.com-API-Schluessel. Wenn nicht gesetzt, werden E-Mails stillschweigend uebersprungen. |
| `EMAIL_FROM_ADDRESS` | Nein | `WhyNot <notifications@whynot.qa>` | gateway | Absenderadresse fuer transaktionale E-Mails |

### Ratenbegrenzungen

| Variable | Erforderlich | Standard | Verwendet von | Beschreibung |
|----------|----------|---------|---------|-------------|
| `RATE_LIMIT_MAX_REQUESTS` | Nein | `100` | gateway | Allgemeines API-Limit pro 15 Min. |
| `RATE_LIMIT_TEST_EXECUTION_MAX` | Nein | `10` | gateway | Testausfuehrungs-Limit pro Stunde |
| `RATE_LIMIT_TEST_GENERATION_MAX` | Nein | `20` | gateway | Testgenerierungs-Limit pro 15 Min. |
| `RATE_LIMIT_QA_LOOP_MAX` | Nein | `5` | gateway | QA-Loop-Sitzungen pro Stunde |
| `RATE_LIMIT_LOGIN_MAX` | Nein | `10` | gateway | Anmeldeversuche pro 15 Min. |
| `RATE_LIMIT_REGISTER_MAX` | Nein | `5` | gateway | Registrierungen pro Stunde |
| `RATE_LIMIT_PUBLIC_MAX` | Nein | `10` | gateway | Oeffentliche Endpunkte pro 15 Min. |

### URLs

| Variable | Erforderlich | Standard | Verwendet von | Beschreibung |
|----------|----------|---------|---------|-------------|
| `FRONTEND_URL` | Nein | `http://localhost:5183` | gateway | Haupt-Frontend-URL |
| `ADMIN_FRONTEND_URL` | Nein | `http://localhost:5184` | gateway | Admin-Frontend-URL |
| `CORS_ALLOWED_ORIGINS` | Nein | — | gateway | Zusaetzliche CORS-Origins (kommagetrennt) |

### Frontend-Build-Zeit (VITE_*)

| Variable | Erforderlich | Standard | Verwendet von | Beschreibung |
|----------|----------|---------|---------|-------------|
| `VITE_API_URL` | Nein | `/api` | frontend, admin-frontend | Backend-API-URL |
| `VITE_WS_URL` | Nein | `ws://localhost:3011` | frontend | Test-Executor-WebSocket-URL |
| `VITE_QA_LOOP_WS_URL` | Nein | `ws://localhost:3012` | frontend | QA-Loop-WebSocket-URL |
| `VITE_APP_VERSION` | Nein | `2.0.0` | frontend | Im Footer angezeigte Version |

### Host-Ports (Docker)

| Variable | Standard | Beschreibung |
|----------|---------|-------------|
| `POSTGRES_PORT` | `5433` | Host-Port fuer PostgreSQL |
| `AI_SERVICE_PORT` | `8010` | Host-Port fuer KI-Dienst |
| `GATEWAY_PORT` | `3010` | Host-Port fuer Gateway |
| `TEST_EXECUTOR_PORT` | `3011` | Host-Port fuer Test-Executor |
| `QA_LOOP_EXECUTOR_PORT` | `3012` | Host-Port fuer QA-Loop-Executor |
| `FRONTEND_PORT` | `5183` | Host-Port fuer Frontend |
| `ADMIN_FRONTEND_PORT` | `5184` | Host-Port fuer Admin-Frontend |

### Beobachtbarkeit

| Variable | Erforderlich | Standard | Verwendet von | Beschreibung |
|----------|----------|---------|---------|-------------|
| `LOG_LEVEL` | Nein | `info` | alle Dienste | `debug`, `info`, `warn` oder `error` |

## CI-Validierung

Fuehren Sie die Synchronisierungspruefung aus, um sicherzustellen, dass `.env.example` mit der Codebasis uebereinstimmt:

```bash
./scripts/check-env-sync.sh
```

Dieses Skript ueberprueft:
1. Keine toten Eintraege in `.env.example` (definiert, aber nicht verwendet)
2. Keine direkten `process.env`-Zugriffe im Gateway ausserhalb von `config/env.ts`
3. Keine direkten `import.meta.env`-Zugriffe in Frontends ausserhalb von `config.ts`
