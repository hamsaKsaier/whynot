# Resolucion de claves de plataforma

La resolucion de claves de plataforma proporciona una gestion centralizada de claves API de IA para todas las operaciones del nivel gestionado. En lugar de almacenar claves en variables de entorno, los administradores configuran y rotan claves a traves del panel de administracion.

## Flujo de resolucion

```
Solicitud del usuario
  -> Verificar la config IA del usuario (getUserAIModel)
  -> Si no hay config de usuario + nivel managed_payg
       -> Resolucion de clave de plataforma (getPlatformAIModel)
            -> Leer proveedor predeterminado de billing_config
            -> Descifrar clave de platform_ai_config
            -> Si el proveedor predeterminado no tiene clave activa
                 -> Iterar ai_fallback_order
                 -> Retornar el primer proveedor con clave activa
            -> Si ningun proveedor tiene claves
                 -> Lanzar errors:ai.noPlatformKey
```

## Funciones principales

| Funcion | Proposito |
|---------|-----------|
| `getPlatformAIModel()` | Retorna la instancia del modelo IA predeterminado de la plataforma con cadena de respaldo |
| `getPlatformAIModelForProvider(provider, model?)` | Retorna una instancia de modelo para un proveedor especifico |
| `getPlatformAPIKey(provider)` | Retorna la clave API descifrada para un proveedor |
| `getAllPlatformConfigs()` | Retorna todos los proveedores activos con claves descifradas (solo uso interno) |

## Comportamiento del cache

Las claves descifradas se almacenan en cache en memoria durante **60 segundos** para evitar consultas a la base de datos en cada solicitud de IA.

- El cache es un singleton global (`platformKeyCache`)
- Las entradas expiran automaticamente despues de 60s de TTL
- Los endpoints de API de administracion llaman a `platformKeyCache.invalidate(provider)` cuando se modifican claves
- `platformKeyCache.invalidateAll()` limpia todo el cache

**Retraso de propagacion:** Los cambios administrativos en las claves se propagan en menos de 60 segundos.

## Cadena de respaldo

La cadena de respaldo se configura mediante dos entradas en `billing_config`:

1. **`default_ai_provider`** — Objeto JSON `{ provider, model }` que especifica el proveedor principal
2. **`ai_fallback_order`** — Array JSON de identificadores de proveedores en orden de prioridad

### Soporte de clave de respaldo

Cada proveedor puede tener una **clave principal** y una **clave de respaldo**:

- La clave principal (`api_key_encrypted`) se intenta primero
- Si la principal es nula pero el respaldo existe (`fallback_key_encrypted`), se usa el respaldo
- Esto maneja la rotacion de claves

## Seguridad

- Todas las claves API estan **cifradas en reposo** con AES-256-GCM
- El descifrado ocurre **solo en memoria** para las llamadas API
- `getAllPlatformConfigs()` esta restringido a endpoints internos — nunca se expone publicamente
- Las claves enmascaradas (formato `sk-*****XXXX`) se usan en todas las respuestas de administracion

## Integracion del nivel gestionado

La funcion `getUserAIModel()` maneja el respaldo basado en el nivel:

1. Si el usuario tiene su propia config IA, se usa (todos los niveles)
2. Si no hay config de usuario y el workspace esta en nivel `managed_payg`, respaldo a `getPlatformAIModel()`
3. Si no hay config de usuario y el workspace esta en nivel `byo_keys`, retorna null
