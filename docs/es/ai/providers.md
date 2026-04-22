---
title: "Matriz de proveedores de IA"
description: "Proveedores de IA soportados por WhyNot QA y su configuracion."
lang: es
draft: false
---

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
import { getPlatformAIModel } from './utils/ai/get-platform-ai-model';
import { generateText } from 'ai';

const model = await getPlatformAIModel();

const { text } = await generateText({
  model,
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

## Configuración de IA de la plataforma

Las claves API de los proveedores de IA se almacenan cifradas en la tabla `platform_ai_config` de la base de datos, gestionadas por super-administradores a través del panel de administración.

> **Nota de migración:** La configuración de claves API basada en `.env` (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, etc.) se ha eliminado de la pasarela. Si está actualizando desde una versión que usaba `.env` para claves de IA, ahora debe configurar las claves a través del panel de administración. La ruta del agente `services/qa-loop-executor/src/v2/` todavía lee de variables de entorno.

### API interna para acceso entre contenedores

La pasarela expone `GET /api/internal/ai-config` para servicios internos (ej. qa-loop-executor) ejecutándose en contenedores Docker separados. Este endpoint devuelve las claves de IA descifradas y está restringido a la red Docker mediante una lista de IPs permitidas.

### Esquema de la tabla

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `provider` | `VARCHAR(50)` | Identificador del proveedor (`openai`, `anthropic`, `google`, `openrouter`) |
| `display_name` | `VARCHAR(100)` | Etiqueta legible |
| `api_key_encrypted` | `BYTEA` | Clave API principal cifrada con AES-256-GCM |
| `fallback_key_encrypted` | `BYTEA` | Clave API de respaldo cifrada con AES-256-GCM |
| `default_model` | `VARCHAR(100)` | Modelo predeterminado para este proveedor |
| `models` | `JSONB` | Lista de modelos disponibles |
| `is_active` | `BOOLEAN` | Activo solo cuando hay una clave válida configurada |
| `rate_limit` | `INTEGER` | Solicitudes por minuto (0 = ilimitado) |

### Cifrado

Todas las claves API se cifran en reposo usando AES-256-GCM (el mismo algoritmo usado para la configuración de IA a nivel de usuario). Cada clave se almacena en tres columnas separadas: texto cifrado, vector de inicialización (IV) y etiqueta de autenticación. La clave de cifrado se configura mediante la variable de entorno `SECRETS_ENCRYPTION_KEY`.

### Proveedor predeterminado y orden de respaldo

El proveedor de IA predeterminado y el orden de respaldo se almacenan en la tabla `billing_config`:

- `default_ai_provider` — Objeto JSON con los campos `provider` y `model`
- `ai_fallback_order` — Array JSON de identificadores de proveedores en orden de prioridad

## Advertencia sobre OpenRouter

OpenRouter utiliza `createOpenAICompatible` en lugar de `createOpenAI`. El SDK de OpenAI v6 utiliza la API Responses (`/responses`) por defecto, que OpenRouter no admite. OpenRouter solo admite el endpoint estándar `/chat/completions`. Consulte el commit `e231a08` para más contexto.
