---
title: "Performance Testing"
description: "WhyNot QA includes built-in performance testing with support for smoke, load, stress, and spike test types. Results are displayed in real-time with ch"
lang: en
draft: false
---

# Performance Testing

## Overview

WhyNot QA includes built-in performance testing with support for smoke, load, stress, and spike test types. Results are displayed in real-time with charts, metrics, and a narrative verdict.

## Localization

All performance test UI strings are fully localized across all 5 supported languages (English, Arabic, French, German, Spanish).

### Verdict Copy

The verdict narrative (the summary shown after a test completes) is generated client-side using `react-i18next` interpolation. The translation keys live in `frontend/public/locales/{lang}/runner.json` under the `runner.performance.verdict.*` namespace.

Each verdict branch accepts dynamic values:

| Key | Interpolation Variables |
|-----|------------------------|
| `verdict.okLatency` | `{{rps}}`, `{{avgMs}}` |
| `verdict.highErrorRate` | `{{errorPct}}` |
| `verdict.moderateErrorRate` | `{{errorPct}}` |
| `verdict.slowP95` | `{{seconds}}` |
| `verdict.moderateP95` | `{{ms}}` |
| `verdict.spikyP99` | `{{ms}}` |
| `verdict.goodAvg` | `{{avgMs}}` |
| `verdict.successRate` | `{{totalRequests}}`, `{{successPct}}` |

### Chart Labels

Chart tooltips and legends use keys under `runner.performance.chart.*`:
- `chart.unit.ms` — milliseconds unit
- `chart.unit.rps` — requests per second unit
- `chart.unit.vus` — virtual users unit
- `chart.legend.p50`, `chart.legend.p95`, `chart.legend.p99` — percentile legend labels

### Test Type Labels

Test type buttons and descriptions use `runner.performance.testType.*` and `runner.performance.testTypeDescription.*` keys.

### Date Formatting

Dates are formatted using `toLocaleString(i18n.language)` to respect the active locale.
