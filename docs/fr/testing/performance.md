---
title: "Tests de performance"
description: "Tests de performance integres dans WhyNot QA avec localisation complete."
lang: fr
draft: false
---

# Tests de performance

## Vue d'ensemble

WhyNot QA inclut des tests de performance intégrés avec prise en charge des types smoke, charge, stress et pic. Les résultats sont affichés en temps réel avec des graphiques, des métriques et un verdict narratif.

## Localisation

Toutes les chaînes de l'interface des tests de performance sont entièrement localisées dans les 5 langues supportées (anglais, arabe, français, allemand, espagnol).

### Texte du verdict

Le récit du verdict (le résumé affiché après la fin d'un test) est généré côté client via l'interpolation `react-i18next`. Les clés de traduction se trouvent dans `frontend/public/locales/{lang}/runner.json` sous l'espace de noms `runner.performance.verdict.*`.

Chaque branche de verdict accepte des valeurs dynamiques :

| Clé | Variables d'interpolation |
|-----|--------------------------|
| `verdict.okLatency` | `{{rps}}`, `{{avgMs}}` |
| `verdict.highErrorRate` | `{{errorPct}}` |
| `verdict.moderateErrorRate` | `{{errorPct}}` |
| `verdict.slowP95` | `{{seconds}}` |
| `verdict.moderateP95` | `{{ms}}` |
| `verdict.spikyP99` | `{{ms}}` |
| `verdict.goodAvg` | `{{avgMs}}` |
| `verdict.successRate` | `{{totalRequests}}`, `{{successPct}}` |

### Libellés des graphiques

Les infobulles et légendes des graphiques utilisent les clés sous `runner.performance.chart.*` :
- `chart.unit.ms` — unité millisecondes
- `chart.unit.rps` — unité requêtes par seconde
- `chart.unit.vus` — unité utilisateurs virtuels
- `chart.legend.p50`, `chart.legend.p95`, `chart.legend.p99` — libellés de légende des percentiles

### Libellés des types de test

Les boutons et descriptions des types de test utilisent les clés `runner.performance.testType.*` et `runner.performance.testTypeDescription.*`.

### Formatage des dates

Les dates sont formatées avec `toLocaleString(i18n.language)` pour respecter la locale active.
