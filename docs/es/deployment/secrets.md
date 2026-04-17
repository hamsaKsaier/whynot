---
title: "Gestion de secretos"
description: "Como WhyNot maneja los valores de configuracion sensibles en los diferentes entornos."
lang: es
draft: true
---

# Gestion de secretos

Este documento describe como WhyNot maneja los valores de configuracion sensibles en los diferentes entornos.

## Principios

1. **Nunca confirmar secretos** — `.env` esta en gitignore. Solo `.env.example` (con valores de ejemplo) se versiona.
2. **Nunca registrar secretos** — El modulo de configuracion del gateway valida los secretos al inicio pero nunca escribe sus valores en los logs.
3. **Fallar rapido** — Los secretos requeridos faltantes causan una falla inmediata al inicio con un mensaje de error claro.

## Desarrollo

En desarrollo local, los secretos se almacenan en su archivo `.env`:

```bash
cp .env.example .env
# Fill in required values:
#   JWT_SECRET          — any long random string
#   SECRETS_ENCRYPTION_KEY — openssl rand -base64 32
#   ENCRYPTION_KEY      — any random string
```

Para desarrollo local, puede usar valores de ejemplo. Las funciones de OAuth y Stripe no estaran disponibles sin credenciales reales.

## Produccion

En produccion, los secretos deben provenir del entorno del host o de un gestor de secretos — **nunca** de un archivo `.env` en disco.

### Enfoques recomendados

#### 1. Variables de entorno del host (lo mas simple)

Configure las variables directamente en el host o en su plataforma de despliegue:

```bash
# Example: systemd service
Environment="JWT_SECRET=<real-value>"
Environment="SECRETS_ENCRYPTION_KEY=<real-value>"

# Example: Docker run
docker run -e JWT_SECRET=<real-value> -e SECRETS_ENCRYPTION_KEY=<real-value> ...
```

#### 2. Docker Secrets (Swarm)

Para despliegues con Docker Swarm, use Docker secrets:

```bash
echo "<real-jwt-secret>" | docker secret create jwt_secret -
```

#### 3. Gestores de secretos en la nube

- **AWS**: Secrets Manager o SSM Parameter Store
- **GCP**: Secret Manager
- **Azure**: Key Vault

Inyecte al iniciar el contenedor mediante la inyeccion nativa de secretos de su orquestador.

## Rotacion de secretos

### JWT_SECRET

Rotar `JWT_SECRET` invalida todas las sesiones de usuario existentes. Para rotar de forma segura:

1. Agregue el nuevo secreto junto al antiguo (si su middleware de autenticacion soporta multiples claves)
2. Despliegue con el nuevo secreto
3. Espere a que los tokens antiguos expiren (predeterminado: 7 dias)
4. Elimine el secreto antiguo

### SECRETS_ENCRYPTION_KEY / ENCRYPTION_KEY

Estas claves cifran credenciales almacenadas y tokens de integracion. La rotacion requiere re-cifrar todos los valores almacenados:

1. Genere una nueva clave: `openssl rand -base64 32`
2. Ejecute la migracion de re-cifrado (si esta disponible)
3. Despliegue con la nueva clave

### Claves de Stripe

Las claves de Stripe se pueden rotar en el panel de Stripe. Actualice las variables de entorno y redespliegue.

## Secretos requeridos por entorno

| Secreto | Desarrollo | Staging | Produccion |
|--------|-------------|---------|------------|
| `JWT_SECRET` | Valor de ejemplo OK | Valor real | Valor real (fuerte) |
| `SECRETS_ENCRYPTION_KEY` | Se puede omitir (funcionalidad degradada) | Valor real | Valor real |
| `ENCRYPTION_KEY` | Se puede omitir (funcionalidad degradada) | Valor real | Valor real |
| `GITHUB_CLIENT_ID/SECRET` | Opcional | Valor real | Valor real |
| `GOOGLE_CLIENT_ID/SECRET` | Opcional | Valor real | Valor real |
| `STRIPE_SECRET_KEY` | Opcional | Clave modo prueba | Clave modo produccion |
| `STRIPE_WEBHOOK_SECRET` | Opcional | Valor real | Valor real |
| `RESEND_API_KEY` | Opcional | Valor real | Valor real |
| `ANTHROPIC_API_KEY` | Requerido para IA | Valor real | Valor real |

## Generacion de secretos

```bash
# JWT secret (64 bytes, base64-encoded)
openssl rand -base64 64

# Encryption key (32 bytes, base64-encoded — required format for AES-256)
openssl rand -base64 32

# Generic random string
openssl rand -hex 32
```
