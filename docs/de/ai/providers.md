# KI-Anbieter-Matrix

WhyNot QA unterstützt mehrere KI-Anbieter über eine einheitliche Fabrik in `gateway/src/utils/ai/select-ai-provider.ts`. Alle Nicht-v2-KI-Aufrufe werden über diese Fabrik geleitet.

## Unterstützte Anbieter

| Anbieter | Erkennungsmuster | SDK | Hinweise |
|----------|-----------------|-----|----------|
| OpenAI | `api.openai.com` | `@ai-sdk/openai` | Standard-OpenAI-API |
| Anthropic | `api.anthropic.com` | `@ai-sdk/anthropic` | Claude-Modelle |
| Google | `generativelanguage.googleapis.com` | `@ai-sdk/google` | Gemini-Modelle |
| OpenRouter | `openrouter.ai` | `@ai-sdk/openai-compatible` | Multi-Modell-Router |
| Benutzerdefiniert | Jede andere URL | `@ai-sdk/openai-compatible` | Jeder OpenAI-kompatible Endpunkt |

## Verwendung

```typescript
import { selectAIProvider } from './utils/ai/select-ai-provider';
import { generateText } from 'ai';

const provider = selectAIProvider({
  apiUrl: 'https://api.anthropic.com',
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

const { text } = await generateText({
  model: provider('claude-sonnet-4-6'),
  prompt: 'Hallo',
});
```

## Anbietererkennung

Die Fabrik erkennt den Anbieter automatisch anhand der API-URL. Sie können die Erkennung überschreiben, indem Sie ein explizites `provider`-Feld übergeben:

```typescript
const provider = selectAIProvider({
  apiUrl: 'https://my-proxy.example.com/anthropic',
  apiKey: 'key',
  provider: 'anthropic',
});
```

## OpenRouter-Hinweis

OpenRouter verwendet `createOpenAICompatible` statt `createOpenAI`. Das OpenAI SDK v6 verwendet standardmäßig die Responses API (`/responses`-Endpunkt), die OpenRouter nicht unterstützt. OpenRouter unterstützt nur den Standard-Endpunkt `/chat/completions`. Siehe Commit `e231a08` für den Kontext.
