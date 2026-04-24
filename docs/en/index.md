---
title: "WhyNot QA Documentation"
description: "Welcome to the WhyNot QA documentation — an AI-powered test automation platform."
lang: en
draft: false
---

# WhyNot QA Documentation

Welcome to the WhyNot QA documentation — an AI-powered test automation platform.

## Sections

### Testing
- [AI Testing](testing/) — How AI test generation and execution works

### Payments
- [Billing & Subscriptions](payments/) — Managing plans, credits, and invoices

### Feature Flags
- [Feature Flag Management](feature-flags/) — Controlling feature availability

### AI
- [AI Provider Configuration](ai/) — Setting up API keys for AI providers

### Internationalization (i18n)
- [How to Add a Translation Key](i18n/how-to-add-a-translation-key.md) — Guide to adding translatable strings

### Recon
- [Recon](recon/) — Authorized, automated reconnaissance and vulnerability scanning

## Supported Languages

WhyNot QA supports the following languages:

| Language | Code | Direction |
|----------|------|-----------|
| English | `en` | Left to Right |
| Arabic | `ar` | Right to Left |
| French | `fr` | Left to Right |
| German | `de` | Left to Right |
| Spanish | `es` | Left to Right |

## RTL Support

The interface fully supports right-to-left text direction for Arabic. When Arabic is selected:

- `dir="rtl"` is set on the HTML element
- Flexbox layouts reverse automatically
- CSS logical properties are used (`ms-*`, `me-*`, `ps-*`, `pe-*`)
- Directional icons are mirrored using `rtl:scale-x-[-1]`
