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
import { getPlatformAIModel } from './utils/ai/get-platform-ai-model';
import { generateText } from 'ai';

const model = await getPlatformAIModel();

const { text } = await generateText({
  model,
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

## Plattform-KI-Konfiguration

API-Schlüssel für KI-Anbieter werden verschlüsselt in der Datenbanktabelle `platform_ai_config` gespeichert und von Super-Administratoren über das Admin-Dashboard verwaltet.

> **Migrationshinweis:** Die `.env`-basierte API-Schlüssel-Konfiguration (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, usw.) wurde aus dem Gateway entfernt. Wenn Sie von einer Version aktualisieren, die `.env` für KI-Schlüssel verwendet hat, müssen Sie die Schlüssel jetzt über das Admin-Dashboard konfigurieren. Der Agent-Pfad `services/qa-loop-executor/src/v2/` liest weiterhin aus Umgebungsvariablen.

### Interne API für Container-übergreifenden Zugriff

Das Gateway stellt `GET /api/internal/ai-config` für interne Dienste (z.B. qa-loop-executor) bereit, die in separaten Docker-Containern laufen. Dieser Endpunkt gibt entschlüsselte KI-Schlüssel zurück und ist über eine IP-Zulassungsliste auf das Docker-Netzwerk beschränkt.

### Tabellenschema

| Spalte | Typ | Beschreibung |
|--------|-----|-------------|
| `provider` | `VARCHAR(50)` | Anbieter-Kennung (`openai`, `anthropic`, `google`, `openrouter`) |
| `display_name` | `VARCHAR(100)` | Lesbarer Name |
| `api_key_encrypted` | `BYTEA` | Primärer API-Schlüssel, AES-256-GCM-verschlüsselt |
| `fallback_key_encrypted` | `BYTEA` | Fallback-API-Schlüssel, AES-256-GCM-verschlüsselt |
| `default_model` | `VARCHAR(100)` | Standardmodell für diesen Anbieter |
| `models` | `JSONB` | Liste verfügbarer Modelle |
| `is_active` | `BOOLEAN` | Aktiv nur wenn ein gültiger Schlüssel konfiguriert ist |
| `rate_limit` | `INTEGER` | Anfragen pro Minute (0 = unbegrenzt) |

### Verschlüsselung

Alle API-Schlüssel werden im Ruhezustand mit AES-256-GCM verschlüsselt (derselbe Algorithmus wie für die KI-Konfiguration auf Benutzerebene). Jeder Schlüssel wird in drei separaten Spalten gespeichert: Chiffretext, Initialisierungsvektor (IV) und Authentifizierungs-Tag. Der Verschlüsselungsschlüssel wird über die Umgebungsvariable `SECRETS_ENCRYPTION_KEY` konfiguriert.

### Standardanbieter und Fallback-Reihenfolge

Der Standard-KI-Anbieter und die Fallback-Reihenfolge werden in der Tabelle `billing_config` gespeichert:

- `default_ai_provider` — JSON-Objekt mit den Feldern `provider` und `model`
- `ai_fallback_order` — JSON-Array der Anbieter-Kennungen in Prioritätsreihenfolge

## OpenRouter-Hinweis

OpenRouter verwendet `createOpenAICompatible` statt `createOpenAI`. Das OpenAI SDK v6 verwendet standardmäßig die Responses API (`/responses`-Endpunkt), die OpenRouter nicht unterstützt. OpenRouter unterstützt nur den Standard-Endpunkt `/chat/completions`. Siehe Commit `e231a08` für den Kontext.
