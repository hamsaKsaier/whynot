---
title: "Recon — Informe de ejemplo"
description: "Un ejemplo redactado de un informe de escaneo Recon."
lang: es
draft: false
---

# Informe de ejemplo

Este es un ejemplo redactado de un informe de escaneo Recon real. Las URLs, parámetros y respuestas se han alterado para proteger el objetivo original. La estructura, la rúbrica de gravedad y el formato de la prueba de concepto son exactamente lo que verás para tus propios escaneos.

Para una explicación de cada sección, ver [Leer los informes](reading-reports.md).

---

## Escaneo: example-staging.acme.dev

| Campo | Valor |
|-------|-------|
| **Objetivo** | `https://example-staging.acme.dev` |
| **Entorno** | `staging` |
| **Alcance** | Estándar |
| **Iniciado** | 2026-04-22 14:02 UTC |
| **Finalizado** | 2026-04-22 14:31 UTC |
| **Lanzado por** | engineer@acme.dev |
| **Referencia de autorización** | INT-4421 (ticket interno de pentest) |

---

## 1. Resumen

Un escaneo estándar de `example-staging.acme.dev` se completó en 29 minutos y produjo **un hallazgo crítico**, **dos altos** y **cuatro medios** confirmados, más once entradas bajas/info.

El hallazgo crítico es una inyección SQL en el endpoint `/api/v1/orders` que permite a un atacante no autenticado leer filas arbitrarias de las tablas `orders` y `customers`. **Trátalo como un incidente.**

Los dos hallazgos altos son un problema de control de acceso roto en `/admin/users` y un XSS almacenado en el campo de notas de pedido; ambos requieren una cuenta de baja privilegio para explotarse.

En comparación con el escaneo anterior (2026-03-15), la SQLi crítica es **nueva**. Tres hallazgos previamente altos están ahora marcados como **corregidos**.

---

## 2. Visión general de riesgos

| Gravedad | Este escaneo | Escaneo anterior | Cambio |
|----------|--------------|------------------|--------|
| Crítica | 1 | 0 | +1 |
| Alta | 2 | 5 | -3 |
| Media | 4 | 4 | 0 |
| Baja | 7 | 9 | -2 |
| Info | 4 | 3 | +1 |

---

## 3. Hallazgos (extracto)

### Hallazgo 1 — Inyección SQL en `/api/v1/orders`

| Campo | Valor |
|-------|-------|
| **Gravedad** | Crítica |
| **Clase** | Inyección SQL (CWE-89) |
| **Objetivo** | `GET /api/v1/orders?status=<param>` |
| **Confianza** | Alta |
| **Resultado de explotación** | Lectura confirmada |

**Qué pasó.** El parámetro de consulta `status` en `/api/v1/orders` se concatena en una cláusula SQL `WHERE` sin parametrización. Un atacante puede escapar del contexto de cadena e inyectar SQL arbitrario. No se requiere autenticación.

**Prueba de concepto.**

```http
GET /api/v1/orders?status=open'%20UNION%20SELECT%20[REDACTED]%20--%20 HTTP/1.1
Host: example-staging.acme.dev

HTTP/1.1 200 OK
Content-Type: application/json

{"orders":[{"id":1,"status":"[REDACTED-RESPONSE]"}]}
```

La cláusula `UNION` inyectada devolvió datos de una tabla diferente, confirmando la inyección. La carga útil real y la respuesta han sido redactadas en este ejemplo.

**Por qué importa.** Un atacante no autenticado puede leer cada fila en cualquier tabla a la que el usuario de la base de datos tenga acceso, incluyendo las tablas `customers` y `orders`. Esta es la clase de vulnerabilidad de mayor impacto contra una base de datos de aplicación web típica.

**Remediación recomendada.** Reemplaza la concatenación de cadenas con consultas parametrizadas en todo el handler de `/api/v1/orders`. La misma ruta de código probablemente existe en endpoints adyacentes — audita el archivo. Ver OWASP A03:2021 — Injection para orientación general.

**Referencias.**

- CWE-89: Neutralización inadecuada de elementos especiales usados en un comando SQL.
- OWASP Top 10 2021: A03 — Injection.

---

### Hallazgo 2 — Control de acceso roto en `/admin/users`

| Campo | Valor |
|-------|-------|
| **Gravedad** | Alta |
| **Clase** | Control de acceso roto (CWE-285) |
| **Objetivo** | `GET /admin/users/{id}` |
| **Confianza** | Alta |
| **Resultado de explotación** | Lectura confirmada |

**Qué pasó.** El endpoint `/admin/users/{id}` comprueba que el solicitante está conectado pero no comprueba que tenga el rol `admin`. Cualquier usuario autenticado puede leer el perfil de cualquier otro usuario, incluyendo email y rol.

**Prueba de concepto.** Una petición autenticada estándar desde una cuenta no admin devolvió el perfil completo de otro usuario. Petición y respuesta redactadas.

**Remediación recomendada.** Añade una comprobación de rol al handler de la ruta. Audita todos los endpoints `/admin/*` por la misma brecha.

---

### Hallazgo 3 — XSS almacenado en notas de pedido

| Campo | Valor |
|-------|-------|
| **Gravedad** | Alta |
| **Clase** | XSS almacenado (CWE-79) |
| **Objetivo** | `POST /api/v1/orders/{id}/notes` |
| **Confianza** | Alta |
| **Resultado de explotación** | Lectura confirmada |

**Qué pasó.** El campo `notes` en un pedido se almacena sin sanitización y se renderiza como HTML en la página de detalles del pedido. Un usuario de baja privilegio puede inyectar un script que se ejecuta cuando un admin ve el pedido.

**Prueba de concepto.** Una carga útil `<script>` (redactada) fue almacenada y observada ejecutándose en una sesión separada.

**Remediación recomendada.** Renderiza `notes` como texto, no como HTML. Si se requiere texto enriquecido, usa un sanitizador validado con una lista blanca estricta.

---

*(Seis hallazgos adicionales omitidos en este ejemplo.)*

---

## 4. Alcance y metodología

- **En el alcance.** `https://example-staging.acme.dev/*` — 47 endpoints descubiertos, 312 parámetros probados.
- **Fuera del alcance.** Todos los demás hosts; el árbol de rutas `/internal-debug/*` (según la configuración del entorno).
- **Autorización.** Ticket interno de pentest INT-4421, firmado por el propietario del entorno staging.
- **Nivel de alcance.** Estándar — escaneo de superficie más sondas activas para clases de vulnerabilidades OWASP-Top-10.

---

## 5. Brechas de cobertura

- **Rutas admin autenticadas.** A Recon se le dio una cuenta de prueba de baja privilegio pero no una cuenta admin. Los hallazgos en `/admin/*` están limitados a problemas que un no-admin autenticado puede alcanzar.
- **Limitación de tasa por WAF.** Tres endpoints bajo `/api/v1/billing/*` devolvieron `429 Too Many Requests` tras 12 sondas cada uno. El rastreo saltó los parámetros restantes en esos endpoints.
- **Trabajos en segundo plano.** Recon no ejercita colas de trabajos asíncronos o tareas programadas. Los problemas que solo se manifiestan en procesamiento en segundo plano están fuera del alcance.

---

## 6. Pista de auditoría

| Fase | Iniciada | Finalizada | Notas |
|------|----------|------------|-------|
| Reconocimiento | 14:02 | 14:08 | 47 endpoints descubiertos. |
| Análisis de superficie | 14:08 | 14:14 | TLS, cabeceras, rutas expuestas. |
| Sondeo activo | 14:14 | 14:28 | 312 parámetros probados. |
| Confirmación | 14:28 | 14:30 | 7 hallazgos candidatos; 7 confirmados. |
| Generación del informe | 14:30 | 14:31 | Informe escrito. |

**Registro de autorización.** Usuario `engineer@acme.dev`, IP `198.51.100.42`, registrado 2026-04-22 14:01:53 UTC, objetivo `https://example-staging.acme.dev`, alcance `standard`, referencia `INT-4421`.

---

Relacionado:

- [Leer los informes](reading-reports.md) — qué significa cada sección.
- [Entender los hallazgos](understanding-findings.md) — rúbrica de gravedad.
- [Inicio rápido](quickstart.md) — lanza tu propio escaneo.
