---
title: "AI Provider Matrix"
description: "WhyNot QA supports multiple AI providers through a unified factory at `gateway/src/utils/ai/select-ai-provider.ts`. All non-v2 AI calls route through "
lang: en
draft: false
---

# AI Provider Matrix

WhyNot QA supports multiple AI providers through a unified factory at `gateway/src/utils/ai/select-ai-provider.ts`. All non-v2 AI calls route through this factory.

## Supported Providers

| Provider | Detection Pattern | SDK | Notes |
|----------|------------------|-----|-------|
| OpenAI | `api.openai.com` | `@ai-sdk/openai` | Default OpenAI API |
| Anthropic | `api.anthropic.com` | `@ai-sdk/anthropic` | Claude models |
| Google | `generativelanguage.googleapis.com` | `@ai-sdk/google` | Gemini models |
| OpenRouter | `openrouter.ai` | `@ai-sdk/openai-compatible` | Multi-model router |
| Custom | Any other URL | `@ai-sdk/openai-compatible` | Any OpenAI-compatible endpoint |

## Usage

```typescript
import { getPlatformAIModel } from './utils/ai/get-platform-ai-model';
import { generateText } from 'ai';

const model = await getPlatformAIModel();

const { text } = await generateText({
  model,
  prompt: 'Hello',
});
```

## Provider Detection

The factory auto-detects the provider from the API URL. You can override detection by passing an explicit `provider` field:

```typescript
const provider = selectAIProvider({
  apiUrl: 'https://my-proxy.example.com/anthropic',
  apiKey: 'key',
  provider: 'anthropic', // Override auto-detection
});
```

## Platform AI Configuration

API keys for AI providers are stored encrypted in the `platform_ai_config` database table, managed by super-admins via the admin dashboard.

> **Migration note:** The `.env`-based API key configuration (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, etc.) has been removed from the gateway. If upgrading from a version that used `.env` for AI keys, you must now configure keys via the admin dashboard. The `services/qa-loop-executor/src/v2/` agent path still reads from env vars.

### Internal API for Cross-Container Access

The gateway exposes `GET /api/internal/ai-config` for internal services (e.g. qa-loop-executor) running in separate Docker containers. This endpoint returns decrypted platform AI keys and is restricted to the Docker network via IP allowlist.

### Table Schema

| Column | Type | Description |
|--------|------|-------------|
| `provider` | `VARCHAR(50)` | Provider identifier (`openai`, `anthropic`, `google`, `openrouter`) |
| `display_name` | `VARCHAR(100)` | Human-readable label |
| `api_key_encrypted` | `BYTEA` | AES-256-GCM encrypted primary API key |
| `fallback_key_encrypted` | `BYTEA` | AES-256-GCM encrypted fallback API key |
| `default_model` | `VARCHAR(100)` | Default model for this provider |
| `models` | `JSONB` | Available models list |
| `is_active` | `BOOLEAN` | Active only when a valid key is configured |
| `rate_limit` | `INTEGER` | Requests per minute (0 = unlimited) |

### Encryption

All API keys are encrypted at rest using AES-256-GCM (same algorithm used for user-level AI config). Each key is stored as three separate columns: ciphertext, initialization vector (IV), and authentication tag. The encryption key is configured via the `SECRETS_ENCRYPTION_KEY` environment variable.

### Default Provider & Fallback Order

The default AI provider and fallback ordering are stored in the `billing_config` table:

- `default_ai_provider` — JSON object with `provider` and `model` fields
- `ai_fallback_order` — JSON array of provider identifiers in priority order

## OpenRouter Caveat

OpenRouter uses `createOpenAICompatible` instead of `createOpenAI`. The OpenAI SDK v6 defaults to the Responses API (`/responses` endpoint), which OpenRouter does not support. OpenRouter only supports the standard `/chat/completions` endpoint. See commit `e231a08` for context.
