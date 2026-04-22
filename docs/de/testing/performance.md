---
title: "Performance-Tests"
description: "Dokumentation der integrierten Performance-Tests und deren Lokalisierung in WhyNot QA."
lang: de
draft: false
---

# Performance-Tests

## Überblick

WhyNot QA enthält integrierte Performance-Tests mit Unterstützung für Smoke-, Last-, Stress- und Spike-Testtypen. Die Ergebnisse werden in Echtzeit mit Diagrammen, Metriken und einem narrativen Urteil angezeigt.

## Lokalisierung

Alle UI-Zeichenketten der Performance-Tests sind vollständig in allen 5 unterstützten Sprachen lokalisiert (Englisch, Arabisch, Französisch, Deutsch, Spanisch).

### Urteilstext

Das Urteilsnarrativ (die Zusammenfassung, die nach Abschluss eines Tests angezeigt wird) wird clientseitig mittels `react-i18next`-Interpolation generiert. Die Übersetzungsschlüssel befinden sich in `frontend/public/locales/{lang}/runner.json` unter dem Namensraum `runner.performance.verdict.*`.

Jeder Urteilszweig akzeptiert dynamische Werte:

| Schlüssel | Interpolationsvariablen |
|-----------|------------------------|
| `verdict.okLatency` | `{{rps}}`, `{{avgMs}}` |
| `verdict.highErrorRate` | `{{errorPct}}` |
| `verdict.moderateErrorRate` | `{{errorPct}}` |
| `verdict.slowP95` | `{{seconds}}` |
| `verdict.moderateP95` | `{{ms}}` |
| `verdict.spikyP99` | `{{ms}}` |
| `verdict.goodAvg` | `{{avgMs}}` |
| `verdict.successRate` | `{{totalRequests}}`, `{{successPct}}` |

### Diagrammbeschriftungen

Diagramm-Tooltips und Legenden verwenden Schlüssel unter `runner.performance.chart.*`:
- `chart.unit.ms` — Einheit Millisekunden
- `chart.unit.rps` — Einheit Anfragen pro Sekunde
- `chart.unit.vus` — Einheit virtuelle Benutzer
- `chart.legend.p50`, `chart.legend.p95`, `chart.legend.p99` — Perzentil-Legendenbeschriftungen

### Testtypbezeichnungen

Schaltflächen und Beschreibungen der Testtypen verwenden die Schlüssel `runner.performance.testType.*` und `runner.performance.testTypeDescription.*`.

### Datumsformatierung

Datumsangaben werden mit `toLocaleString(i18n.language)` formatiert, um die aktive Spracheinstellung zu berücksichtigen.
