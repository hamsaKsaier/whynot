---
title: "Recon — Inicio rápido"
description: "Ejecuta tu primer escaneo Recon en unos cinco minutos."
lang: es
draft: false
---

# Inicio rápido de Recon

Ejecuta tu primer escaneo Recon en unos cinco minutos. Esta guía te lleva por el asistente de nuevo escaneo de principio a fin, desde la autorización hasta los primeros hallazgos.

Antes de empezar:

- Debes ser propietario del espacio de trabajo o tener el permiso `recon.scan.create`.
- El espacio de trabajo debe tener activada la bandera `recon_enabled`. Pregunta a tu administrador si no ves la sección Recon en la barra lateral.
- Debes tener el derecho legal de escanear el entorno objetivo. Lee primero [Autorización y uso responsable](responsible-use.md).

---

## Paso 1 — Abrir el asistente de nuevo escaneo

1. En la barra lateral, haz clic en **Recon**.
2. En la página principal de Recon, haz clic en **Nuevo escaneo**.

El asistente se abre con un flujo de cuatro pasos: **Objetivo → Autorización → Alcance → Revisión**.

## Paso 2 — Elegir tu objetivo

Rellena el panel de objetivo:

| Campo | Qué introducir |
|-------|----------------|
| **Entorno** | El entorno a escanear. Los entornos etiquetados como `production` muestran una advertencia destacada — ver más abajo. |
| **URL base** | La URL raíz desde la que arranca el escaneo. Debe ser `https://` en la mayoría de espacios de trabajo. |
| **Repositorio (opcional)** | Vincula un repositorio git conectado para que Recon también pueda razonar sobre tu código fuente además del sitio en vivo. |
| **Nombre del escaneo** | Una etiqueta corta. Por defecto: nombre del entorno más la fecha actual. |

> **Advertencia de producción.** Si eliges un entorno etiquetado como `production`, Recon muestra una advertencia amarilla. Recon ejecutará el escaneo de todos modos — lo autorizaste explícitamente —, pero asegúrate de que realmente quieres tráfico en vivo y sondas activas contra producción. En caso de duda, elige un entorno de staging o preview.

## Paso 3 — Confirmar la autorización

Cada escaneo requiere un registro de **autorización por escaneo**. Es una barrera legal, no una mejora de UX: estás diciendo a la plataforma, por escrito, que tienes permiso para escanear este objetivo.

En el panel de autorización:

1. Marca **Estoy autorizado/a a escanear este objetivo.**
2. Marca **Entiendo que este escaneo enviará sondas activas.**
3. Introduce la **entidad legal** que representas (p. ej., el nombre de tu empresa).
4. Pega opcionalmente una referencia a tu autorización por escrito (ID de ticket, hilo de correo, contrato).

Al enviar, Recon escribe una fila inmutable en el registro de auditoría de autorización vinculada a tu usuario, IP, marca de tiempo y la URL objetivo exacta. Puedes revisarla más tarde en **Configuración → Recon → Registro de auditoría**.

Si no puedes marcar las tres casillas, detente. Aún no tienes autorización.

## Paso 4 — Elegir el alcance

El alcance controla cuán amplio y profundo va el escaneo.

- **Escaneo de superficie** — solo reconocimiento pasivo. Rápido, de bajo coste, sin sondeo activo.
- **Escaneo estándar** — escaneo de superficie más sondas activas para clases de vulnerabilidades comunes. Recomendado para la mayoría de espacios de trabajo.
- **Escaneo profundo** — escaneo estándar más sondeo autenticado y presupuestos de rastreo más largos. Consume más créditos.

Cada opción muestra su coste estimado en créditos antes de comprometerte. También puedes establecer un **límite de créditos por escaneo** en **Configuración → Recon**; los escaneos que excederían el límite se terminan antes de iniciar la siguiente fase pagada.

## Paso 5 — Revisar y lanzar

El último panel resume todo: objetivo, autorización, alcance, coste estimado y advertencias. Cuando haces clic en **Lanzar escaneo**, Recon:

1. Escribe la fila del escaneo.
2. Escribe la fila de autorización.
3. Encola el escaneo.
4. Te redirige a la página de detalles del escaneo.

## Qué pasa después

- La página de detalles del escaneo se actualiza en tiempo real a medida que cada fase se completa.
- Cuando el escaneo termina, los hallazgos aparecen en la pestaña **Hallazgos**.
- Cada hallazgo incluye una calificación de gravedad, una prueba de concepto y una remediación recomendada. Ver [Entender los hallazgos](understanding-findings.md).
- Los informes pueden compartirse y exportarse a PDF. Ver [Leer los informes](reading-reports.md).

## Has terminado

Desde aquí, lee:

- [Autorización y uso responsable](responsible-use.md) — tus obligaciones legales.
- [Entender los hallazgos](understanding-findings.md) — cómo leer la gravedad, los resultados de explotación y los marcadores de falso positivo.
- [Cuotas y facturación](quotas.md) — qué cuesta un escaneo en cada plan.
- [Solución de problemas](troubleshooting.md) — cuando un escaneo se atasca o falla.
