---
title: "Recon — Leer los informes"
description: "Estructura del informe, compartir y exportar a PDF de los resultados de escaneo de Recon."
lang: es
draft: false
---

# Leer los informes

Un informe de Recon es la salida legible por humanos de un escaneo. Está organizado para ser útil a tres audiencias en el mismo documento: un ingeniero que tiene que arreglar el problema, un revisor de seguridad que tiene que validarlo y un ejecutivo que necesita conocer el alcance del impacto.

Esta página explica la estructura del informe, cómo compartirlo y cómo exportarlo a PDF.

---

## Dónde encontrar los informes

Cada escaneo produce un informe, disponible inmediatamente cuando el escaneo termina.

- Desde la página principal de Recon, haz clic en la fila de un escaneo para abrir su página de detalles.
- En la página de detalles del escaneo, la pestaña **Informe** muestra el informe completo en línea.
- Cada escaneo también tiene una URL estable — puedes compartirla (sujeto a los permisos de abajo).

## Estructura del informe

Un informe tiene seis secciones, siempre en este orden:

### 1. Resumen

Un párrafo escrito para un lector ejecutivo. Indica el objetivo, el alcance, el total de hallazgos por gravedad y el punto único más importante («Se confirmó un hallazgo crítico.», o «Sin hallazgos explotables.»).

### 2. Visión general de riesgos

Una tabla del recuento de hallazgos por gravedad, con comparación al escaneo anterior del mismo objetivo si existe.

| Gravedad | Este escaneo | Escaneo anterior | Cambio |
|----------|--------------|------------------|--------|
| Crítica | 1 | 0 | +1 |
| Alta | 3 | 5 | -2 |
| Media | 7 | 6 | +1 |
| Baja | 12 | 14 | -2 |
| Info | 22 | 19 | +3 |

La columna de cambio es el mejor indicador único de si la remediación está funcionando.

### 3. Hallazgos

Cada hallazgo se renderiza como una tarjeta completa que contiene:

- Título e insignia de gravedad.
- Objetivo (endpoint, parámetro o superficie).
- Clase de vulnerabilidad.
- **Qué pasó** — descripción en lenguaje claro.
- **Prueba de concepto** — el artefacto reproducible, con resaltado de sintaxis.
- **Resultado de explotación** — lectura confirmada, escritura confirmada, etc. Ver [Entender los hallazgos](understanding-findings.md).
- **Por qué importa** — el impacto en el mundo real.
- **Remediación recomendada** — una corrección específica y accionable.
- **Referencias** — enlaces a CWE, OWASP y avisos del proveedor cuando proceda.

Los hallazgos se ordenan por gravedad descendente, luego por confianza descendente.

### 4. Alcance y metodología

Lista qué se escaneó (URLs, endpoints descubiertos, parámetros probados), qué quedó explícitamente fuera del alcance, la referencia de autorización y el nivel de alcance del escaneo (superficie, estándar, profundo).

### 5. Brechas de cobertura

Divulgación honesta de lo que el escaneo no alcanzó: endpoints que requerían autenticación que Recon no tenía, endpoints bloqueados por reglas WAF, áreas donde el presupuesto de rastreo se agotó. Un escaneo que no revela sus brechas se sobrevende.

### 6. Pista de auditoría

El registro de autorización (quién, cuándo, qué objetivo, qué referencia), las marcas de tiempo de inicio y fin del escaneo y una entrada de procedencia de una línea por cada fase.

## Compartir un informe

Hay tres formas de compartir un informe:

### Miembros del espacio de trabajo

Cualquier persona del espacio de trabajo con el permiso `recon.scan.view` puede abrir el informe directamente. No se necesita acción adicional.

### Enlace compartible (externo)

Genera un enlace de solo lectura con tiempo limitado para un revisor que no es miembro del espacio de trabajo.

1. Abre la página de detalles del escaneo.
2. Haz clic en **Compartir** en la cabecera.
3. Elige una caducidad (24 horas, 7 días o 30 días) y, opcionalmente, una contraseña.
4. Copia el enlace y envíalo.

Los visores externos ven una vista saneada: el contenido del informe, pero no la navegación del espacio de trabajo, ni datos de facturación, ni otros escaneos. No pueden activar un reescaneo ni modificar nada.

### Exportar a PDF

Haz clic en **Exportar PDF** en la cabecera del informe. Recon renderiza el informe a PDF usando la misma plantilla que la vista web. El PDF:

- Incluye cada sección de arriba.
- Incrusta las pruebas de concepto como bloques de código formateados.
- Está paginado con una cabecera repetida (nombre del escaneo, objetivo, fecha).
- Es adecuado para adjuntarse a un ticket de auditoría o enviarse por correo a un ejecutivo.

La exportación PDF se genera bajo demanda y no se almacena en caché — una nueva exportación tras un reescaneo recoge los datos más recientes.

## Resumen de permisos

| Acción | Permiso requerido |
|--------|-------------------|
| Ver un informe en el espacio de trabajo | `recon.scan.view` |
| Crear un enlace compartible | `recon.scan.share` |
| Exportar como PDF | `recon.scan.view` |
| Revocar un enlace compartible | `recon.scan.share` o propietario |
| Eliminar un escaneo y su informe | Propietario del espacio de trabajo |

## Retención

Los informes se conservan durante toda la ventana de retención de datos de tu plan (ver [Cuotas](quotas.md) — Free: 7 días, Pro BYO: 30 días, Pro Managed: 90 días). Tras la expiración, el informe se elimina; la fila del registro de auditoría de autorización se conserva durante toda la vida del espacio de trabajo.

## Cuándo reescanear

Reescanea cuando:

- Crees haber corregido al menos un hallazgo. El diff de la sección 2 es la verificación.
- El objetivo ha cambiado sustancialmente (nuevos endpoints, nuevo modelo de auth).
- Han pasado más de 30 días desde el último escaneo de un objetivo crítico.

No reescanees solo para agitar el informe. Cada escaneo cuesta créditos (ver [Cuotas](quotas.md)) y cada escaneo registra una nueva entrada de autorización.

---

Relacionado:

- [Entender los hallazgos](understanding-findings.md) — rúbrica de gravedad y resultados de explotación.
- [Informe de ejemplo](sample-report.md) — un ejemplo redactado.
- [Cuotas y facturación](quotas.md) — qué cuesta un reescaneo.
