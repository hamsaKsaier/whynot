---
title: "Referencia de variables de entorno"
description: "Referencia completa de todas las variables de entorno utilizadas por la plataforma WhyNot."
lang: es
draft: true
---

# Referencia de variables de entorno

Este documento es la referencia oficial de cada variable de entorno utilizada por la plataforma WhyNot.

## Inicio rapido

```bash
cp .env.example .env
# Edit .env and fill in REQUIRED values
# Then: make start
```

## Arquitectura de configuracion

- **Gateway** — validado al inicio mediante esquema Zod en `gateway/src/config/env.ts`. Las variables requeridas faltantes causan una salida inmediata con un error claro.
- **Frontend** — las variables de tiempo de compilacion con prefijo `VITE_` se incorporan en el bundle JS. Centralizadas en `frontend/src/config.ts`.
- **Admin Frontend** — mismo patron, centralizado en `admin-frontend/src/config.ts`.
- **Servicios** (test-executor, qa-loop-executor) — leen `process.env` directamente; Docker Compose pasa las variables mediante `environment:` o `env_file:`.

## Referencia de variables

### Base de datos

| Variable | Requerida | Predeterminado | Usado por | Descripcion |
|----------|----------|---------|---------|-------------|
| `DATABASE_URL` | No | _(construido a partir de POSTGRES_*)_ | gateway, servicios | Cadena de conexion completa de PostgreSQL. Sobreescribe las variables individuales. |
| `POSTGRES_USER` | No | `whynot` | gateway, servicios, Docker | Usuario de la base de datos |
| `POSTGRES_PASSWORD` | No | `whynot` | gateway, servicios, Docker | Contrasena de la base de datos (**cambiar en produccion**) |
| `POSTGRES_DB` | No | `whynot` | gateway, servicios, Docker | Nombre de la base de datos |
| `POSTGRES_HOST` | No | `database` | gateway | Nombre de host (nombre del servicio Docker en contenedores) |
| `POSTGRES_PORT` | No | `5433` | Docker | Puerto del **host** para PostgreSQL |

### Autenticacion

| Variable | Requerida | Predeterminado | Usado por | Descripcion |
|----------|----------|---------|---------|-------------|
| `JWT_SECRET` | **Si** | — | gateway | Clave de firma de tokens. Generar: `openssl rand -base64 64` |
| `GITHUB_CLIENT_ID` | Para login con GitHub | — | gateway | ID de cliente de la aplicacion OAuth de GitHub |
| `GITHUB_CLIENT_SECRET` | Para login con GitHub | — | gateway | Secreto de cliente de la aplicacion OAuth de GitHub |
| `GITHUB_CALLBACK_URL` | No | `http://localhost:3010/api/auth/github/callback` | gateway | URL de callback de OAuth |
| `GOOGLE_CLIENT_ID` | Para login con Google | — | gateway | ID de cliente de OAuth de Google |
| `GOOGLE_CLIENT_SECRET` | Para login con Google | — | gateway | Secreto de cliente de OAuth de Google |
| `GOOGLE_CALLBACK_URL` | No | `http://localhost:3010/api/auth/google/callback` | gateway | URL de callback de OAuth |

### Cifrado

| Variable | Requerida | Predeterminado | Usado por | Descripcion |
|----------|----------|---------|---------|-------------|
| `SECRETS_ENCRYPTION_KEY` | **Si** (para secretos) | — | gateway | Clave AES-256, 32 bytes base64. Generar: `openssl rand -base64 32` |
| `ENCRYPTION_KEY` | **Si** (para integraciones) | — | gateway | Clave de cifrado de tokens de integracion |

### Facturacion con Stripe

| Variable | Requerida | Predeterminado | Usado por | Descripcion |
|----------|----------|---------|---------|-------------|
| `STRIPE_SECRET_KEY` | Para pagos | — | gateway | Clave secreta de la API de Stripe |
| `STRIPE_PUBLISHABLE_KEY` | Para pagos | — | gateway | Clave publicable de Stripe |
| `STRIPE_WEBHOOK_SECRET` | Para pagos | — | gateway | Secreto de firma de webhook de Stripe |
| `STRIPE_SUCCESS_URL` | No | `http://localhost:5183/billing?success=true` | gateway | Redireccion tras checkout exitoso |
| `STRIPE_CANCEL_URL` | No | `http://localhost:5183/billing?canceled=true` | gateway | Redireccion tras cancelacion de checkout |
| `STRIPE_PRICE_*` | No | — | gateway | IDs de precios de Stripe para cada nivel de plan |

### Proveedores de IA

| Variable | Requerida | Predeterminado | Usado por | Descripcion |
|----------|----------|---------|---------|-------------|
| `LLM_PROVIDER` | No | `anthropic` | ai-service | Proveedor de IA: `anthropic` u `openai` |
| `ANTHROPIC_API_KEY` | Si proveedor=anthropic | — | gateway, ai-service | Clave API de Anthropic |
| `ANTHROPIC_MODEL` | No | `claude-sonnet-4-6` | ai-service | ID del modelo de Anthropic |
| `OPENAI_API_KEY` | Si proveedor=openai | — | ai-service | Clave API de OpenAI |
| `OPENAI_MODEL` | No | `gpt-4` | ai-service | ID del modelo de OpenAI |
| `OPENAI_VISION_MODEL` | No | `gpt-4o` | ai-service | Modelo de vision de OpenAI |

### Correo electronico

| Variable | Requerida | Predeterminado | Usado por | Descripcion |
|----------|----------|---------|---------|-------------|
| `RESEND_API_KEY` | No | — | gateway | Clave API de Resend.com. Si no esta configurada, los correos se omiten silenciosamente. |
| `EMAIL_FROM_ADDRESS` | No | `WhyNot <notifications@whynot.qa>` | gateway | Direccion del remitente para correos transaccionales |

### Limites de tasa

| Variable | Requerida | Predeterminado | Usado por | Descripcion |
|----------|----------|---------|---------|-------------|
| `RATE_LIMIT_MAX_REQUESTS` | No | `100` | gateway | Limite general de API por 15 min |
| `RATE_LIMIT_TEST_EXECUTION_MAX` | No | `10` | gateway | Limite de ejecucion de pruebas por hora |
| `RATE_LIMIT_TEST_GENERATION_MAX` | No | `20` | gateway | Limite de generacion de pruebas por 15 min |
| `RATE_LIMIT_QA_LOOP_MAX` | No | `5` | gateway | Sesiones de QA loop por hora |
| `RATE_LIMIT_LOGIN_MAX` | No | `10` | gateway | Intentos de inicio de sesion por 15 min |
| `RATE_LIMIT_REGISTER_MAX` | No | `5` | gateway | Registros por hora |
| `RATE_LIMIT_PUBLIC_MAX` | No | `10` | gateway | Endpoints publicos por 15 min |

### URLs

| Variable | Requerida | Predeterminado | Usado por | Descripcion |
|----------|----------|---------|---------|-------------|
| `FRONTEND_URL` | No | `http://localhost:5183` | gateway | URL del frontend principal |
| `ADMIN_FRONTEND_URL` | No | `http://localhost:5184` | gateway | URL del frontend de administracion |
| `CORS_ALLOWED_ORIGINS` | No | — | gateway | Origenes CORS adicionales (separados por comas) |

### Tiempo de compilacion del frontend (VITE_*)

| Variable | Requerida | Predeterminado | Usado por | Descripcion |
|----------|----------|---------|---------|-------------|
| `VITE_API_URL` | No | `/api` | frontend, admin-frontend | URL de la API del backend |
| `VITE_WS_URL` | No | `ws://localhost:3011` | frontend | URL de WebSocket del ejecutor de pruebas |
| `VITE_QA_LOOP_WS_URL` | No | `ws://localhost:3012` | frontend | URL de WebSocket de QA loop |
| `VITE_APP_VERSION` | No | `2.0.0` | frontend | Version mostrada en el pie de pagina |

### Puertos del host (Docker)

| Variable | Predeterminado | Descripcion |
|----------|---------|-------------|
| `POSTGRES_PORT` | `5433` | Puerto del host para PostgreSQL |
| `AI_SERVICE_PORT` | `8010` | Puerto del host para el servicio de IA |
| `GATEWAY_PORT` | `3010` | Puerto del host para el gateway |
| `TEST_EXECUTOR_PORT` | `3011` | Puerto del host para el ejecutor de pruebas |
| `QA_LOOP_EXECUTOR_PORT` | `3012` | Puerto del host para el ejecutor de QA loop |
| `FRONTEND_PORT` | `5183` | Puerto del host para el frontend |
| `ADMIN_FRONTEND_PORT` | `5184` | Puerto del host para el frontend de administracion |

### Observabilidad

| Variable | Requerida | Predeterminado | Usado por | Descripcion |
|----------|----------|---------|---------|-------------|
| `LOG_LEVEL` | No | `info` | todos los servicios | `debug`, `info`, `warn` o `error` |

## Validacion en CI

Ejecute la verificacion de sincronizacion para asegurar que `.env.example` coincida con el codigo fuente:

```bash
./scripts/check-env-sync.sh
```

Este script verifica:
1. No hay entradas muertas en `.env.example` (definidas pero no utilizadas)
2. No hay lecturas directas de `process.env` en el gateway fuera de `config/env.ts`
3. No hay lecturas directas de `import.meta.env` en los frontends fuera de `config.ts`
