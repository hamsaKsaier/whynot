# Matriz de proveedores de IA

WhyNot QA admite múltiples proveedores de IA a través de una fábrica unificada en `gateway/src/utils/ai/select-ai-provider.ts`. Todas las llamadas de IA no-v2 pasan por esta fábrica.

## Proveedores admitidos

| Proveedor | Patrón de detección | SDK | Notas |
|-----------|-------------------|-----|-------|
| OpenAI | `api.openai.com` | `@ai-sdk/openai` | API estándar de OpenAI |
| Anthropic | `api.anthropic.com` | `@ai-sdk/anthropic` | Modelos Claude |
| Google | `generativelanguage.googleapis.com` | `@ai-sdk/google` | Modelos Gemini |
| OpenRouter | `openrouter.ai` | `@ai-sdk/openai-compatible` | Enrutador multimodelo |
| Personalizado | Cualquier otra URL | `@ai-sdk/openai-compatible` | Cualquier endpoint compatible con OpenAI |

## Uso

```typescript
import { selectAIProvider } from './utils/ai/select-ai-provider';
import { generateText } from 'ai';

const provider = selectAIProvider({
  apiUrl: 'https://api.anthropic.com',
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

const { text } = await generateText({
  model: provider('claude-sonnet-4-6'),
  prompt: 'Hola',
});
```

## Detección del proveedor

La fábrica detecta automáticamente el proveedor a partir de la URL de la API. Puede anular la detección pasando un campo `provider` explícito:

```typescript
const provider = selectAIProvider({
  apiUrl: 'https://my-proxy.example.com/anthropic',
  apiKey: 'key',
  provider: 'anthropic',
});
```

## Advertencia sobre OpenRouter

OpenRouter utiliza `createOpenAICompatible` en lugar de `createOpenAI`. El SDK de OpenAI v6 utiliza la API Responses (`/responses`) por defecto, que OpenRouter no admite. OpenRouter solo admite el endpoint estándar `/chat/completions`. Consulte el commit `e231a08` para más contexto.
