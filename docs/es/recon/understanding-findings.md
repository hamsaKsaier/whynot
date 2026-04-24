---
title: "Recon — Entender los hallazgos"
description: "Rúbrica de gravedad, semántica de los resultados de explotación y política de falsos positivos para los hallazgos de Recon."
lang: es
draft: false
---

# Entender los hallazgos

Un escaneo de Recon produce cero o más **hallazgos**. Cada hallazgo representa un problema de seguridad confirmado o sospechado en el objetivo, calificado por gravedad y acompañado de una prueba de concepto reproducible.

Esta página explica cómo leer un hallazgo: qué significan las etiquetas de gravedad, qué te dice el campo de resultado de explotación y cómo Recon decide qué incluir en un informe.

---

## Anatomía de un hallazgo

Cada hallazgo tiene los siguientes campos:

| Campo | Significado |
|-------|-------------|
| **Título** | Un resumen breve del problema. |
| **Gravedad** | Crítica, Alta, Media, Baja o Info. Ver la rúbrica más abajo. |
| **Clase de vulnerabilidad** | La categoría — inyección SQL, XSS reflejado, SSRF, control de acceso roto, etc. |
| **Objetivo** | El endpoint o superficie donde se encontró el problema. |
| **Prueba de concepto** | Un artefacto reproducible (petición, comando o script) que demuestra el problema. |
| **Resultado de explotación** | Lo que la prueba de concepto realmente logró. Ver más abajo. |
| **Remediación recomendada** | Una corrección concreta, no una línea genérica sobre «buenas prácticas de programación». |
| **Confianza** | Alta, Media o Baja — qué tan seguro está Recon de que es un problema real. |
| **Primera / Última vista** | Marcas de tiempo a través de los escaneos. Reescanear las actualiza. |

## Rúbrica de gravedad

Recon usa una rúbrica de cinco niveles. La gravedad se calcula a partir de tres entradas: el impacto técnico, la facilidad de explotación y la cantidad de datos sensibles o acciones privilegiadas expuestas.

### Crítica

El problema permite a un atacante remoto no autenticado lograr uno de los siguientes:

- Ejecutar código arbitrario en el objetivo.
- Leer o modificar datos de producción arbitrarios.
- Suplantar la identidad de otro usuario sin su cooperación.
- Eludir un control de seguridad central (autenticación, facturación, multi-tenencia) con una sola petición.

Los hallazgos críticos deben tratarse como incidentes. Asume que la explotación es inminente.

### Alta

El problema permite escalado de privilegios, acceso no autorizado a datos o elusión de un control de seguridad, pero requiere al menos uno de los siguientes:

- Una cuenta válida de baja privilegio.
- Interacción del usuario (p. ej., hacer clic en un enlace preparado).
- Múltiples peticiones encadenadas.

Los hallazgos altos deben corregirse en días, no en semanas.

### Media

El problema expone información sensible, debilita un control de seguridad o permite un ataque que requiere un esfuerzo adicional significativo (p. ej., un exploit encadenado, o un token de sesión robado). Los hallazgos medios deben corregirse en el siguiente ciclo de release.

### Baja

El problema es una brecha de endurecimiento o una capa débil de defensa en profundidad. Explotarlo de forma aislada da poco. Ejemplos: cabeceras de seguridad ausentes, mensajes de error verbosos, banners de servidor obsoletos.

### Info

El problema no es una vulnerabilidad sino una pieza de contexto sobre la superficie de ataque que debes conocer: un panel de administración expuesto, un dominio de staging indexado por motores de búsqueda, un subdominio que no debería ser público.

## Resultados de explotación

Cada hallazgo en un informe está respaldado por un intento de explotación concreto. El campo **resultado de explotación** te dice qué hizo realmente ese intento:

| Resultado | Significado |
|-----------|-------------|
| **Lectura confirmada** | Una prueba de concepto no destructiva tuvo éxito: se leyeron datos, se devolvió un marcador, o un error filtró información. Seguro de repetir. |
| **Escritura confirmada** | Una carga útil destructiva tuvo éxito: el estado cambió, se creó, actualizó o eliminó un registro. Recon ejecuta los exploits de clase escritura exactamente una vez por escaneo y nunca los reintenta (ver [Uso responsable](responsible-use.md)). |
| **Escritura intentada, resultado desconocido** | Se envió una carga útil destructiva pero la respuesta no indicó claramente éxito o fallo. Trátalo como vulnerabilidad sospechada y verifica manualmente. |
| **Lectura intentada, no concluyente** | Una sonda no destructiva se ejecutó pero la evidencia es ambigua. Habitualmente se rebaja a Info o se suprime. |

## Sin exploit, sin informe

Recon sigue una política estricta de **«sin exploit, sin informe»**. Un hallazgo aparece en el informe **solo** si tiene un `proof_of_concept` no nulo y exactamente reproducible. Si una sonda no pudo producir un artefacto funcional, el hallazgo se suprime o se publica como Info sin entrada en el informe.

Es deliberado. Un informe lleno de entradas de «inyección SQL sospechada» que no puedes reproducir es peor que no tener informe, porque desperdicia tiempo de triaje y erosiona la confianza. Cuando Recon entrega un hallazgo, puedes reproducirlo.

## Política de falsos positivos

Un falso positivo es un hallazgo que parecía real para la pipeline automatizada pero que en realidad no es explotable. La pipeline de Recon tiene tres protecciones contra falsos positivos:

1. **Confirmación activa.** Cada hallazgo reportado incluye una prueba de concepto que se ejecutó realmente y se observó produciendo el resultado afirmado.
2. **Etiquetado de confianza.** Los hallazgos donde la confirmación tuvo éxito pero el contexto es ambiguo se etiquetan con confianza `medium` o `low` y se acompañan de un descargo de responsabilidad.
3. **Descarte por el usuario.** Puedes descartar cualquier hallazgo con un motivo: `false_positive`, `accepted_risk`, `duplicate` u `out_of_scope`. Los hallazgos descartados no cuentan en los agregados de gravedad y se suprimen del diff del siguiente escaneo a menos que la evidencia subyacente cambie.

Si encuentras un falso positivo que la pipeline debería haber capturado, usa el enlace **Reportar falso positivo** en la tarjeta del hallazgo. Usamos estos reportes para mejorar la puntuación de confianza.

## Reescaneos y diffs

Cuando reescaneas el mismo objetivo:

- Los hallazgos que aún están presentes actualizan su marca de tiempo `last_seen`.
- Los hallazgos que estaban presentes antes y ahora ya no lo están se marcan como **corregidos**.
- Los hallazgos nuevos aparecen con una insignia `new`.

Así verificas que una remediación realmente aterrizó. Un informe donde un hallazgo previamente Crítico está ahora marcado como **corregido** es la salida más útil que Recon puede producir.

---

Relacionado:

- [Leer los informes](reading-reports.md) — estructura del informe, compartir, exportar PDF.
- [Informe de ejemplo](sample-report.md) — un ejemplo redactado.
- [Uso responsable](responsible-use.md) — por qué los exploits de clase escritura nunca se reintentan.
