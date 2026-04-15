# Matrice des fournisseurs d'IA

WhyNot QA prend en charge plusieurs fournisseurs d'IA via une fabrique unifiée dans `gateway/src/utils/ai/select-ai-provider.ts`. Tous les appels IA non-v2 passent par cette fabrique.

## Fournisseurs pris en charge

| Fournisseur | Modèle de détection | SDK | Notes |
|-------------|-------------------|-----|-------|
| OpenAI | `api.openai.com` | `@ai-sdk/openai` | API OpenAI par défaut |
| Anthropic | `api.anthropic.com` | `@ai-sdk/anthropic` | Modèles Claude |
| Google | `generativelanguage.googleapis.com` | `@ai-sdk/google` | Modèles Gemini |
| OpenRouter | `openrouter.ai` | `@ai-sdk/openai-compatible` | Routeur multi-modèles |
| Personnalisé | Toute autre URL | `@ai-sdk/openai-compatible` | Tout point de terminaison compatible OpenAI |

## Utilisation

```typescript
import { selectAIProvider } from './utils/ai/select-ai-provider';
import { generateText } from 'ai';

const provider = selectAIProvider({
  apiUrl: 'https://api.anthropic.com',
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

const { text } = await generateText({
  model: provider('claude-sonnet-4-6'),
  prompt: 'Bonjour',
});
```

## Détection du fournisseur

La fabrique détecte automatiquement le fournisseur à partir de l'URL de l'API. Vous pouvez remplacer la détection en passant un champ `provider` explicite :

```typescript
const provider = selectAIProvider({
  apiUrl: 'https://my-proxy.example.com/anthropic',
  apiKey: 'key',
  provider: 'anthropic',
});
```

## Avertissement OpenRouter

OpenRouter utilise `createOpenAICompatible` au lieu de `createOpenAI`. Le SDK OpenAI v6 utilise par défaut l'API Responses (point de terminaison `/responses`), que OpenRouter ne prend pas en charge. OpenRouter ne prend en charge que le point de terminaison standard `/chat/completions`. Voir le commit `e231a08` pour le contexte.
