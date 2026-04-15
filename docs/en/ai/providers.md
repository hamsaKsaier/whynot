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
import { selectAIProvider } from './utils/ai/select-ai-provider';
import { generateText } from 'ai';

const provider = selectAIProvider({
  apiUrl: 'https://api.anthropic.com',
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

const { text } = await generateText({
  model: provider('claude-sonnet-4-6'),
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

## OpenRouter Caveat

OpenRouter uses `createOpenAICompatible` instead of `createOpenAI`. The OpenAI SDK v6 defaults to the Responses API (`/responses` endpoint), which OpenRouter does not support. OpenRouter only supports the standard `/chat/completions` endpoint. See commit `e231a08` for context.
