# Arquitectura del sistema de Feature Flags

## Modelo de dos tablas

El sistema de feature flags utiliza dos tablas de base de datos:

### `feature_flags` — Definiciones globales de banderas

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `key` | `text` (PK) | Identificador en snake_case, coincide con el registro |
| `name` | `text` | Nombre legible para humanos |
| `description` | `text` | Lo que controla la bandera |
| `default_enabled` | `boolean` | Estado predeterminado para nuevas organizaciones |
| `rollout_percent` | `integer` | Porcentaje de despliegue (0–100) |
| `created_at` | `timestamptz` | Fecha de creación |
| `updated_at` | `timestamptz` | Última modificación |

### `organization_feature_flags` — Sobreescrituras por organización

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `organization_id` | `uuid` (PK, FK) | Referencia a `organizations(id)` |
| `flag_key` | `text` (PK, FK) | Referencia a `feature_flags(key)` |
| `enabled` | `boolean` | Valor sobreescrito para esta organización |
| `set_by` | `uuid` (FK) | Administrador que estableció la sobreescritura |
| `set_at` | `timestamptz` | Fecha de la sobreescritura |

## El registro como fuente de verdad

Todas las claves de banderas válidas se definen en `shared/constants/platform-features.ts`. Este registro:

- Exporta `PLATFORM_FEATURES` — un objeto constante que mapea claves enum a valores snake_case en DB
- Exporta `PlatformFeatureKey` — el tipo unión de todas las claves válidas
- Exporta `isValidFeatureKey()` — un type guard para validación en tiempo de ejecución
- Exporta `ALL_PLATFORM_FEATURE_KEYS` — array de todas las claves válidas

## Orden de resolución de bandera

1. Verificar `organization_feature_flags` para sobreescritura específica de la organización
2. Si no hay sobreescritura, usar `feature_flags.default_enabled`
3. Si `rollout_percent > 0` y no hay sobreescritura, usar hash determinístico de `org_id + flag_key`

## Agregar una nueva bandera

1. Agregar la clave a `PLATFORM_FEATURES` en `shared/constants/platform-features.ts`
2. Agregar entrada de seed en `shared/database/seeds/feature-flags.ts`
3. Ejecutar el script de seed — es idempotente (`ON CONFLICT ... DO UPDATE`)
4. Usar `isValidFeatureKey()` en fronteras de API para validar claves entrantes

## Auditoría

Cada mutación de bandera se escribe en la tabla `audit_log`.
