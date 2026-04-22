---
title: "Pruebas de rendimiento"
description: "Pruebas de rendimiento integradas en WhyNot QA con soporte para multiples tipos de prueba."
lang: es
draft: false
---

# Pruebas de rendimiento

## Descripcion general

WhyNot QA incluye pruebas de rendimiento integradas con soporte para tipos de prueba de humo, carga, estres y pico. Los resultados se muestran en tiempo real con graficos, metricas y un veredicto narrativo.

## Localizacion

Todas las cadenas de la interfaz de pruebas de rendimiento estan completamente localizadas en los 5 idiomas soportados (ingles, arabe, frances, aleman, espanol).

### Texto del veredicto

La narrativa del veredicto (el resumen mostrado despues de que finaliza una prueba) se genera del lado del cliente usando interpolacion de `react-i18next`. Las claves de traduccion se encuentran en `frontend/public/locales/{lang}/runner.json` bajo el namespace `runner.performance.verdict.*`.

Cada rama del veredicto acepta valores dinamicos:

| Clave | Variables de interpolacion |
|-------|---------------------------|
| `verdict.okLatency` | `{{rps}}`, `{{avgMs}}` |
| `verdict.highErrorRate` | `{{errorPct}}` |
| `verdict.moderateErrorRate` | `{{errorPct}}` |
| `verdict.slowP95` | `{{seconds}}` |
| `verdict.moderateP95` | `{{ms}}` |
| `verdict.spikyP99` | `{{ms}}` |
| `verdict.goodAvg` | `{{avgMs}}` |
| `verdict.successRate` | `{{totalRequests}}`, `{{successPct}}` |

### Etiquetas de graficos

Las descripciones emergentes y leyendas de los graficos usan claves bajo `runner.performance.chart.*`:
- `chart.unit.ms` — unidad de milisegundos
- `chart.unit.rps` — unidad de solicitudes por segundo
- `chart.unit.vus` — unidad de usuarios virtuales
- `chart.legend.p50`, `chart.legend.p95`, `chart.legend.p99` — etiquetas de leyenda de percentiles

### Etiquetas de tipos de prueba

Los botones y descripciones de los tipos de prueba usan las claves `runner.performance.testType.*` y `runner.performance.testTypeDescription.*`.

### Formato de fechas

Las fechas se formatean usando `toLocaleString(i18n.language)` para respetar la configuracion regional activa.
