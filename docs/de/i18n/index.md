---
title: "Internationalisierung (i18n)"
description: "Uebersicht der Internationalisierungsarchitektur von WhyNot QA mit Unterstuetzung fuer 5 Sprachen."
lang: de
draft: false
---

# Internationalisierung (i18n)

WhyNot QA unterstützt 5 Sprachen: Englisch, Arabisch, Französisch, Deutsch und Spanisch.

## Architektur

- **Bibliothek:** [react-i18next](https://react.i18next.com/) v15 + i18next v23
- **Backend:** `i18next-http-backend` lädt Übersetzungen aus `/locales/{lang}/{namespace}.json`
- **Erkennung:** `i18next-browser-languagedetector` prüft localStorage > Browser > HTML-lang-Attribut
- **RTL:** Arabisch setzt `dir="rtl"` auf `<html>` über den LanguageSwitcher
- **Fallback:** Englisch (`en`) ist die Fallback-Sprache

## Locale-Dateien

```
frontend/public/locales/
  en/    ar/    fr/    de/    es/
    common.json
    auth.json
    dashboard.json
    runner.json
    results.json
    settings.json
    billing.json
    landing.json
```

## Neue Schlüssel zum Runner-Namespace hinzufügen

Der `runner`-Namespace enthält alle UI-Zeichenketten des Testausführers, einschließlich des Performance-Urteilstexts. Beim Hinzufügen neuer Schlüssel folgen Sie dem Interpolationsmuster der Urteilsschlüssel als Beispiel:

```json
{
  "runner.performance.verdict.okLatency": "{{rps}} Anf./s bei einer durchschnittlichen Latenz von {{avgMs}} ms verarbeitet.",
  "runner.performance.verdict.highErrorRate": "{{errorPct}} % der Anfragen sind fehlgeschlagen."
}
```

Siehe [Lokalisierung der Performance-Tests](../testing/performance.md) für die vollständige Liste der Urteilsschlüssel und ihrer Interpolationsvariablen.

## Anleitungen

- [So fügen Sie einen Übersetzungsschlüssel hinzu](./how-to-add-a-translation-key.md)

## Backend-Lokalisierung

Die Gateway-API ist vollständig lokalisiert. Alle API-Antworten berücksichtigen den `Accept-Language`-Header, der vom Client gesendet wird.

### Der `Accept-Language`-Vertrag

Jede API-Antwort gibt lokalisierte Fehlermeldungen und Erfolgstexte basierend auf dem `Accept-Language`-Request-Header zurück. Unterstützte Werte: `en`, `ar`, `fr`, `de`, `es`. Wenn der Header fehlt oder einen nicht erkannten Locale enthält, fällt die API auf `en` zurück.

### Wie `req.t()` funktioniert

Die i18n-Middleware unter `gateway/src/middleware/i18n.ts` analysiert den `Accept-Language`-Header, initialisiert einen Übersetzer pro Anfrage und hängt ihn als `req.t()` an. Verwendung in Route-Handlern:

```typescript
// Einfache Schlüsselabfrage
req.t('errors:auth.unauthorized')

// Mit Interpolation
req.t('success:admin.planUpdated', { planName })
```

### Wo die Backend-Übersetzungen liegen

```
gateway/src/i18n/translations/
  en/    ar/    fr/    de/    es/
    errors.json
    success.json
    validation.json
    emails.json
    billing.json
```

Jedes Unterverzeichnis spiegelt dieselben Namespace-Dateien wider. Jeder Schlüssel in `en/` muss in allen anderen Sprachverzeichnissen vorhanden sein.

### Einen neuen Fehler- oder Erfolgsschlüssel hinzufügen

1. Fügen Sie den Schlüssel zu `en/{namespace}.json` hinzu (z. B. `en/errors.json`).
2. Fügen Sie die entsprechende Übersetzung in die Dateien `ar/`, `fr/`, `de/` und `es/` für denselben Namespace ein.
3. Verwenden Sie `req.t('namespace:key')` im Route-Handler:
   ```typescript
   res.status(403).json({
     error: { code: 'auth.forbidden', message: req.t('errors:auth.forbidden') }
   });
   ```
4. Für Hilfsfunktionen ohne Zugriff auf `req` verwenden Sie `createError` mit dem i18n-Schlüssel:
   ```typescript
   createError(msg, code, status, details, 'errors:auth.forbidden')
   ```
5. Führen Sie den Test `i18n-backend-completeness.test.ts` aus, um zu überprüfen, dass alle Sprachen den neuen Schlüssel haben.

### E-Mail-Vorlagen-Lokalisierung

E-Mail-Vorlagen verwenden `i18n.getFixedT(recipientLocale, 'emails')` zur Übersetzung von Inhalten. Der Locale stammt aus der gespeicherten Sprachpräferenz des Benutzers (Benutzerdatensatz), nicht aus dem `Accept-Language`-Header der Anfrage. So erhalten Benutzer E-Mails in ihrer bevorzugten Sprache, unabhängig davon, welcher Client die Aktion ausgelöst hat.

### Fehlerantwort-Format

API-Fehler folgen einem von zwei Formaten:

```json
{
  "error": {
    "code": "auth.invalidCredentials",
    "message": "<lokalisierter Text>"
  }
}
```

oder:

```json
{
  "success": false,
  "error": "<lokalisierter Text>"
}
```

Der `message`- / `error`-Wert ist immer basierend auf dem `Accept-Language`-Header der Anfrage lokalisiert (oder dem gespeicherten Locale des Benutzers bei E-Mails).

## Tests

- `i18n-completeness.test.ts` prüft die Konsistenz des Schlüsselbaums über alle Sprachen
- `i18n-no-hardcoded-strings.test.ts` sucht nach unübersetzten englischen Zeichenketten in Seitenkomponenten
- `i18n.test.ts` validiert die i18n-Konfiguration (Sprachen, RTL, Metadaten)

## Konfiguration

- Frontend: `frontend/src/i18n.ts`
- Admin: `admin-frontend/src/i18n.ts`
- Sprachumschalter: `frontend/src/components/LanguageSwitcher.tsx`

## i18n-Abdeckung testen

### Eine neue Seite zum Manifest hinzufuegen

Jede benutzersichtbare Seite muss in `pages-manifest.ts` registriert werden:

- **Frontend:** `frontend/src/__tests__/pages-manifest.ts`
- **Admin:** `admin-frontend/src/__tests__/pages-manifest.ts`

Fuegen Sie einen Eintrag mit `key`, `path`, `routePattern`, `component` und `requiresAuth` hinzu. Die Testsuite `pages-i18n.test.tsx` iteriert ueber dieses Manifest x 5 Locales.

### Wie der English-Leak-Scanner funktioniert

Fuer nicht-englische Locales durchsucht der Test `document.body.innerText` nach ASCII-Latin-Sequenzen mit 4 oder mehr Zeichen (`/\b[A-Za-z]{4,}\b/`). Jeder Treffer, der nicht in der gemeinsamen Marken-Allowlist (`shared/constants/brand-allowlist.ts`) enthalten ist, wird als potenziell unuebersetzter Text markiert.

Speziell fuer Arabisch prueft der Test zusaetzlich, dass mindestens ein arabisches Zeichen (`[\u0600-\u06FF]`) in der gerenderten Ausgabe vorhanden ist.

### Einen neuen Gateway-Router zum Integrationstest hinzufuegen

Bearbeiten Sie `gateway/src/__tests__/api/i18n-integration.test.ts`:

1. Fuegen Sie Testrouten hinzu, die `req.t()` mit den relevanten Uebersetzungsschluesseln ausueben.
2. Fuegen Sie Testfaelle im describe-Block fuer jede Sprache hinzu.
3. Fuegen Sie Fallback-Tests hinzu (unbekannter `Accept-Language`-Header oder fehlender Header).

### Einen fehlschlagenden Page-Locale-Test debuggen

1. Fuehren Sie den spezifischen Test aus: `make shell-frontend npx vitest run --reporter=verbose src/__tests__/pages-i18n.test.tsx`
2. Pruefen Sie die Fehlermeldung — sie listet die gefundenen unuebersetzten lateinischen Woerter auf.
3. Wenn das Wort ein legitimes Kognat oder ein Markenname ist, fuegen Sie es zu `shared/constants/brand-allowlist.ts` hinzu.
4. Wenn das Wort unuebersetzter UI-Text ist, fuegen Sie den fehlenden Uebersetzungsschluessel zur Locale-JSON-Datei hinzu.
5. Wenn die Seite nicht gerendert wird, pruefen Sie, ob alle Abhaengigkeiten in `pages-i18n.test.tsx` gemockt sind.

### Tests ausfuehren

```bash
make test                 # alle Pakete
make test-frontend        # nur Frontend
make test-admin           # nur Admin-Frontend
make test-backend         # nur Gateway
```
