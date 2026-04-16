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
import { getPlatformAIModel } from './utils/ai/get-platform-ai-model';
import { generateText } from 'ai';

const model = await getPlatformAIModel();

const { text } = await generateText({
  model,
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

## Configuration IA de la plateforme

Les clés API des fournisseurs d'IA sont stockées chiffrées dans la table `platform_ai_config` de la base de données, gérées par les super-administrateurs via le tableau de bord d'administration.

> **Note de migration :** La configuration des clés API via `.env` (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, etc.) a été supprimée de la passerelle. Si vous mettez à jour depuis une version qui utilisait `.env` pour les clés IA, vous devez maintenant configurer les clés via le tableau de bord d'administration. Le chemin agent `services/qa-loop-executor/src/v2/` lit toujours les variables d'environnement.

### API interne pour l'accès inter-conteneurs

La passerelle expose `GET /api/internal/ai-config` pour les services internes (ex. qa-loop-executor) exécutés dans des conteneurs Docker séparés. Ce point de terminaison retourne les clés IA déchiffrées et est restreint au réseau Docker via une liste d'autorisation IP.

### Schéma de la table

| Colonne | Type | Description |
|---------|------|-------------|
| `provider` | `VARCHAR(50)` | Identifiant du fournisseur (`openai`, `anthropic`, `google`, `openrouter`) |
| `display_name` | `VARCHAR(100)` | Libellé lisible |
| `api_key_encrypted` | `BYTEA` | Clé API principale chiffrée en AES-256-GCM |
| `fallback_key_encrypted` | `BYTEA` | Clé API de secours chiffrée en AES-256-GCM |
| `default_model` | `VARCHAR(100)` | Modèle par défaut pour ce fournisseur |
| `models` | `JSONB` | Liste des modèles disponibles |
| `is_active` | `BOOLEAN` | Actif uniquement lorsqu'une clé valide est configurée |
| `rate_limit` | `INTEGER` | Requêtes par minute (0 = illimité) |

### Chiffrement

Toutes les clés API sont chiffrées au repos avec AES-256-GCM (le même algorithme utilisé pour la configuration IA au niveau utilisateur). Chaque clé est stockée en trois colonnes distinctes : texte chiffré, vecteur d'initialisation (IV) et étiquette d'authentification. La clé de chiffrement est configurée via la variable d'environnement `SECRETS_ENCRYPTION_KEY`.

### Fournisseur par défaut et ordre de repli

Le fournisseur d'IA par défaut et l'ordre de repli sont stockés dans la table `billing_config` :

- `default_ai_provider` — Objet JSON avec les champs `provider` et `model`
- `ai_fallback_order` — Tableau JSON des identifiants de fournisseurs par ordre de priorité

## Avertissement OpenRouter

OpenRouter utilise `createOpenAICompatible` au lieu de `createOpenAI`. Le SDK OpenAI v6 utilise par défaut l'API Responses (point de terminaison `/responses`), que OpenRouter ne prend pas en charge. OpenRouter ne prend en charge que le point de terminaison standard `/chat/completions`. Voir le commit `e231a08` pour le contexte.
