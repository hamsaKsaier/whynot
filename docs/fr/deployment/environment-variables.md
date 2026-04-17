---
title: "Reference des variables d'environnement"
description: "Reference complete de toutes les variables d'environnement utilisees par la plateforme WhyNot."
lang: fr
draft: true
---

# Reference des variables d'environnement

Ce document est la reference officielle pour chaque variable d'environnement utilisee par la plateforme WhyNot.

## Demarrage rapide

```bash
cp .env.example .env
# Edit .env and fill in REQUIRED values
# Then: make start
```

## Architecture de la configuration

- **Gateway** — validee au demarrage via un schema Zod dans `gateway/src/config/env.ts`. Les variables requises manquantes provoquent un arret immediat avec un message d'erreur clair.
- **Frontend** — les variables de build prefixees `VITE_` sont integrees dans le bundle JS. Centralisees dans `frontend/src/config.ts`.
- **Admin Frontend** — meme principe, centralisees dans `admin-frontend/src/config.ts`.
- **Services** (test-executor, qa-loop-executor) — lisent `process.env` directement ; Docker Compose transmet les variables via `environment:` ou `env_file:`.

## Reference des variables

### Base de donnees

| Variable | Requise | Defaut | Utilise par | Description |
|----------|---------|--------|-------------|-------------|
| `DATABASE_URL` | Non | _(construit a partir de POSTGRES_*)_ | gateway, services | Chaine de connexion PostgreSQL complete. Remplace les variables individuelles. |
| `POSTGRES_USER` | Non | `whynot` | gateway, services, Docker | Utilisateur de la base de donnees |
| `POSTGRES_PASSWORD` | Non | `whynot` | gateway, services, Docker | Mot de passe de la base de donnees (**changer en production**) |
| `POSTGRES_DB` | Non | `whynot` | gateway, services, Docker | Nom de la base de donnees |
| `POSTGRES_HOST` | Non | `database` | gateway | Nom d'hote (nom du service Docker dans les conteneurs) |
| `POSTGRES_PORT` | Non | `5433` | Docker | Port **hote** pour PostgreSQL |

### Authentification

| Variable | Requise | Defaut | Utilise par | Description |
|----------|---------|--------|-------------|-------------|
| `JWT_SECRET` | **Oui** | — | gateway | Cle de signature des tokens. Generer : `openssl rand -base64 64` |
| `GITHUB_CLIENT_ID` | Pour connexion GitHub | — | gateway | Client ID de l'application OAuth GitHub |
| `GITHUB_CLIENT_SECRET` | Pour connexion GitHub | — | gateway | Client secret de l'application OAuth GitHub |
| `GITHUB_CALLBACK_URL` | Non | `http://localhost:3010/api/auth/github/callback` | gateway | URL de callback OAuth |
| `GOOGLE_CLIENT_ID` | Pour connexion Google | — | gateway | Client ID OAuth Google |
| `GOOGLE_CLIENT_SECRET` | Pour connexion Google | — | gateway | Client secret OAuth Google |
| `GOOGLE_CALLBACK_URL` | Non | `http://localhost:3010/api/auth/google/callback` | gateway | URL de callback OAuth |

### Chiffrement

| Variable | Requise | Defaut | Utilise par | Description |
|----------|---------|--------|-------------|-------------|
| `SECRETS_ENCRYPTION_KEY` | **Oui** (pour les secrets) | — | gateway | Cle AES-256, 32 octets en base64. Generer : `openssl rand -base64 32` |
| `ENCRYPTION_KEY` | **Oui** (pour les integrations) | — | gateway | Cle de chiffrement des tokens d'integration |

### Facturation Stripe

| Variable | Requise | Defaut | Utilise par | Description |
|----------|---------|--------|-------------|-------------|
| `STRIPE_SECRET_KEY` | Pour les paiements | — | gateway | Cle secrete de l'API Stripe |
| `STRIPE_PUBLISHABLE_KEY` | Pour les paiements | — | gateway | Cle publiable Stripe |
| `STRIPE_WEBHOOK_SECRET` | Pour les paiements | — | gateway | Secret de signature des webhooks Stripe |
| `STRIPE_SUCCESS_URL` | Non | `http://localhost:5183/billing?success=true` | gateway | Redirection apres paiement reussi |
| `STRIPE_CANCEL_URL` | Non | `http://localhost:5183/billing?canceled=true` | gateway | Redirection apres annulation |
| `STRIPE_PRICE_*` | Non | — | gateway | Identifiants de prix Stripe pour chaque palier |

### Fournisseurs d'IA

| Variable | Requise | Defaut | Utilise par | Description |
|----------|---------|--------|-------------|-------------|
| `LLM_PROVIDER` | Non | `anthropic` | ai-service | Fournisseur IA : `anthropic` ou `openai` |
| `ANTHROPIC_API_KEY` | Si provider=anthropic | — | gateway, ai-service | Cle API Anthropic |
| `ANTHROPIC_MODEL` | Non | `claude-sonnet-4-6` | ai-service | Identifiant du modele Anthropic |
| `OPENAI_API_KEY` | Si provider=openai | — | ai-service | Cle API OpenAI |
| `OPENAI_MODEL` | Non | `gpt-4` | ai-service | Identifiant du modele OpenAI |
| `OPENAI_VISION_MODEL` | Non | `gpt-4o` | ai-service | Modele de vision OpenAI |

### E-mail

| Variable | Requise | Defaut | Utilise par | Description |
|----------|---------|--------|-------------|-------------|
| `RESEND_API_KEY` | Non | — | gateway | Cle API Resend.com. Si absente, les e-mails sont ignores silencieusement. |
| `EMAIL_FROM_ADDRESS` | Non | `WhyNot <notifications@whynot.qa>` | gateway | Adresse d'expediteur pour les e-mails transactionnels |

### Limites de debit

| Variable | Requise | Defaut | Utilise par | Description |
|----------|---------|--------|-------------|-------------|
| `RATE_LIMIT_MAX_REQUESTS` | Non | `100` | gateway | Limite API generale par 15 min |
| `RATE_LIMIT_TEST_EXECUTION_MAX` | Non | `10` | gateway | Limite d'execution de tests par heure |
| `RATE_LIMIT_TEST_GENERATION_MAX` | Non | `20` | gateway | Limite de generation de tests par 15 min |
| `RATE_LIMIT_QA_LOOP_MAX` | Non | `5` | gateway | Sessions de boucle QA par heure |
| `RATE_LIMIT_LOGIN_MAX` | Non | `10` | gateway | Tentatives de connexion par 15 min |
| `RATE_LIMIT_REGISTER_MAX` | Non | `5` | gateway | Inscriptions par heure |
| `RATE_LIMIT_PUBLIC_MAX` | Non | `10` | gateway | Points de terminaison publics par 15 min |

### URLs

| Variable | Requise | Defaut | Utilise par | Description |
|----------|---------|--------|-------------|-------------|
| `FRONTEND_URL` | Non | `http://localhost:5183` | gateway | URL du frontend principal |
| `ADMIN_FRONTEND_URL` | Non | `http://localhost:5184` | gateway | URL du frontend d'administration |
| `CORS_ALLOWED_ORIGINS` | Non | — | gateway | Origines CORS supplementaires (separees par des virgules) |

### Frontend au moment du build (VITE_*)

| Variable | Requise | Defaut | Utilise par | Description |
|----------|---------|--------|-------------|-------------|
| `VITE_API_URL` | Non | `/api` | frontend, admin-frontend | URL de l'API backend |
| `VITE_WS_URL` | Non | `ws://localhost:3011` | frontend | URL WebSocket de l'executeur de tests |
| `VITE_QA_LOOP_WS_URL` | Non | `ws://localhost:3012` | frontend | URL WebSocket de la boucle QA |
| `VITE_APP_VERSION` | Non | `2.0.0` | frontend | Version affichee dans le pied de page |

### Ports hotes (Docker)

| Variable | Defaut | Description |
|----------|--------|-------------|
| `POSTGRES_PORT` | `5433` | Port hote pour PostgreSQL |
| `AI_SERVICE_PORT` | `8010` | Port hote pour le service IA |
| `GATEWAY_PORT` | `3010` | Port hote pour la passerelle |
| `TEST_EXECUTOR_PORT` | `3011` | Port hote pour l'executeur de tests |
| `QA_LOOP_EXECUTOR_PORT` | `3012` | Port hote pour l'executeur de boucle QA |
| `FRONTEND_PORT` | `5183` | Port hote pour le frontend |
| `ADMIN_FRONTEND_PORT` | `5184` | Port hote pour le frontend d'administration |

### Observabilite

| Variable | Requise | Defaut | Utilise par | Description |
|----------|---------|--------|-------------|-------------|
| `LOG_LEVEL` | Non | `info` | tous les services | `debug`, `info`, `warn` ou `error` |

## Validation CI

Executez la verification de synchronisation pour vous assurer que `.env.example` correspond a la base de code :

```bash
./scripts/check-env-sync.sh
```

Ce script verifie :
1. Aucune entree obsolete dans `.env.example` (definie mais non utilisee)
2. Aucune lecture directe de `process.env` dans la passerelle en dehors de `config/env.ts`
3. Aucune lecture directe de `import.meta.env` dans les frontends en dehors de `config.ts`
