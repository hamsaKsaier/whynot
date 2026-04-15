# Secret Management

This document describes how WhyNot handles sensitive configuration values across environments.

## Principles

1. **Never commit secrets** — `.env` is gitignored. Only `.env.example` (with placeholders) is tracked.
2. **Never log secrets** — The gateway config module validates secrets at startup but never writes their values to logs.
3. **Fail fast** — Missing required secrets cause immediate startup failure with a clear error message.

## Development

In local development, secrets live in your `.env` file:

```bash
cp .env.example .env
# Fill in required values:
#   JWT_SECRET          — any long random string
#   SECRETS_ENCRYPTION_KEY — openssl rand -base64 32
#   ENCRYPTION_KEY      — any random string
```

For local dev, you can use placeholder values. OAuth and Stripe features will be unavailable without real credentials.

## Production

In production, secrets should come from the host environment or a secret manager — **never** from a `.env` file on disk.

### Recommended Approaches

#### 1. Host Environment Variables (simplest)

Set vars directly on the host or in your deployment platform:

```bash
# Example: systemd service
Environment="JWT_SECRET=<real-value>"
Environment="SECRETS_ENCRYPTION_KEY=<real-value>"

# Example: Docker run
docker run -e JWT_SECRET=<real-value> -e SECRETS_ENCRYPTION_KEY=<real-value> ...
```

#### 2. Docker Secrets (Swarm)

For Docker Swarm deployments, use Docker secrets:

```bash
echo "<real-jwt-secret>" | docker secret create jwt_secret -
```

#### 3. Cloud Secret Managers

- **AWS**: Secrets Manager or SSM Parameter Store
- **GCP**: Secret Manager
- **Azure**: Key Vault

Inject at container start via your orchestrator's native secret injection.

## Secret Rotation

### JWT_SECRET

Rotating `JWT_SECRET` invalidates all existing user sessions. To rotate gracefully:

1. Add the new secret alongside the old one (if your auth middleware supports multiple keys)
2. Deploy with the new secret
3. Wait for old tokens to expire (default: 7 days)
4. Remove the old secret

### SECRETS_ENCRYPTION_KEY / ENCRYPTION_KEY

These encrypt stored credentials and integration tokens. Rotating requires re-encrypting all stored values:

1. Generate a new key: `openssl rand -base64 32`
2. Run the re-encryption migration (if available)
3. Deploy with the new key

### Stripe Keys

Stripe keys can be rotated in the Stripe Dashboard. Update the env vars and redeploy.

## Required Secrets by Environment

| Secret | Development | Staging | Production |
|--------|-------------|---------|------------|
| `JWT_SECRET` | Placeholder OK | Real value | Real value (strong) |
| `SECRETS_ENCRYPTION_KEY` | Can skip (feature degrades) | Real value | Real value |
| `ENCRYPTION_KEY` | Can skip (feature degrades) | Real value | Real value |
| `GITHUB_CLIENT_ID/SECRET` | Optional | Real value | Real value |
| `GOOGLE_CLIENT_ID/SECRET` | Optional | Real value | Real value |
| `STRIPE_SECRET_KEY` | Optional | Test mode key | Live mode key |
| `STRIPE_WEBHOOK_SECRET` | Optional | Real value | Real value |
| `RESEND_API_KEY` | Optional | Real value | Real value |
| `ANTHROPIC_API_KEY` | Required for AI | Real value | Real value |

## Generating Secrets

```bash
# JWT secret (64 bytes, base64-encoded)
openssl rand -base64 64

# Encryption key (32 bytes, base64-encoded — required format for AES-256)
openssl rand -base64 32

# Generic random string
openssl rand -hex 32
```
