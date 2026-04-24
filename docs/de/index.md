---
title: "WhyNot QA Dokumentation"
description: "Willkommen bei der WhyNot QA Dokumentation — einer KI-gestuetzten Testautomatisierungsplattform."
lang: de
draft: true
---

# WhyNot QA Dokumentation

Willkommen bei der WhyNot QA Dokumentation — einer KI-gestuetzten Testautomatisierungsplattform.

## Bereiche

### Testen
- [KI-Tests](testing/) — Wie KI-Testgenerierung und -ausfuehrung funktioniert

### Zahlungen
- [Abrechnung & Abonnements](payments/) — Verwaltung von Plaenen, Guthaben und Rechnungen

### Feature-Flags
- [Feature-Flag-Verwaltung](feature-flags/) — Steuerung der Feature-Verfuegbarkeit

### KI
- [KI-Anbieter-Konfiguration](ai/) — Einrichtung von API-Schluesseln fuer KI-Anbieter

### Internationalisierung (i18n)
- [So fuegen Sie einen Uebersetzungsschluessel hinzu](i18n/how-to-add-a-translation-key.md) — Anleitung zum Hinzufuegen uebersetzbarer Zeichenketten

### Recon
- [Recon](recon/) — Autorisierte, automatisierte Reconnaissance und Schwachstellenprüfung

## Unterstuetzte Sprachen

WhyNot QA unterstuetzt die folgenden Sprachen:

| Sprache | Code | Richtung |
|----------|------|-----------|
| Englisch | `en` | Links nach Rechts |
| Arabisch | `ar` | Rechts nach Links |
| Franzoesisch | `fr` | Links nach Rechts |
| Deutsch | `de` | Links nach Rechts |
| Spanisch | `es` | Links nach Rechts |

## RTL-Unterstuetzung

Die Benutzeroberflaeche unterstuetzt vollstaendig die Rechts-nach-Links-Textrichtung fuer Arabisch. Wenn Arabisch ausgewaehlt ist:

- `dir="rtl"` wird auf dem HTML-Element gesetzt
- Flexbox-Layouts werden automatisch umgekehrt
- CSS-logische Eigenschaften werden verwendet (`ms-*`, `me-*`, `ps-*`, `pe-*`)
- Richtungsweisende Icons werden mit `rtl:scale-x-[-1]` gespiegelt
