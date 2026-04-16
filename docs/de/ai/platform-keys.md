# Plattform-Schluessel-Auflosung

Die Plattform-Schluessel-Auflosung bietet eine zentralisierte Verwaltung von KI-API-Schluesseln fuer alle verwalteten Tier-Operationen. Anstatt Schluessel in Umgebungsvariablen zu speichern, konfigurieren und rotieren Administratoren Schluessel ueber das Admin-Dashboard.

## Aufloesungsfluss

```
Benutzeranfrage
  -> KI-Konfiguration des Benutzers pruefen (getUserAIModel)
  -> Wenn keine Benutzerkonfig + managed_payg Tier
       -> Plattform-Schluessel-Auflosung (getPlatformAIModel)
            -> Standard-Anbieter aus billing_config lesen
            -> Schluessel aus platform_ai_config entschluesseln
            -> Wenn Standard-Anbieter keinen aktiven Schluessel hat
                 -> ai_fallback_order durchlaufen
                 -> Ersten Anbieter mit aktivem Schluessel zurueckgeben
            -> Wenn kein Anbieter Schluessel hat
                 -> errors:ai.noPlatformKey werfen
```

## Hauptfunktionen

| Funktion | Zweck |
|----------|-------|
| `getPlatformAIModel()` | Gibt die Standard-KI-Modellinstanz der Plattform mit Fallback-Kette zurueck |
| `getPlatformAIModelForProvider(provider, model?)` | Gibt eine Modellinstanz fuer einen bestimmten Anbieter zurueck |
| `getPlatformAPIKey(provider)` | Gibt den entschluesselten API-Schluessel fuer einen Anbieter zurueck |
| `getAllPlatformConfigs()` | Gibt alle aktiven Anbieter mit entschluesselten Schluesseln zurueck (nur interner Gebrauch) |

## Cache-Verhalten

Entschluesselte Schluessel werden **60 Sekunden** im Arbeitsspeicher zwischengespeichert, um Datenbankzugriffe bei jeder KI-Anfrage zu vermeiden.

- Der Cache ist ein globaler Singleton (`platformKeyCache`)
- Eintraege verfallen automatisch nach 60s TTL
- Admin-API-Endpoints rufen `platformKeyCache.invalidate(provider)` auf, wenn Schluessel geaendert werden
- `platformKeyCache.invalidateAll()` leert den gesamten Cache

**Ausbreitungsverzoegerung:** Admin-Aenderungen an Schluesseln werden innerhalb von 60 Sekunden wirksam.

## Fallback-Kette

Die Fallback-Kette wird ueber zwei `billing_config`-Eintraege konfiguriert:

1. **`default_ai_provider`** — JSON-Objekt `{ provider, model }` fuer den primaeren Anbieter
2. **`ai_fallback_order`** — JSON-Array von Anbieter-IDs in Prioritaetsreihenfolge

### Fallback-Schluessel-Unterstuetzung

Jeder Anbieter kann einen **primaeren Schluessel** und einen **Fallback-Schluessel** haben:

- Der primaere Schluessel (`api_key_encrypted`) wird zuerst versucht
- Wenn der primaere null ist, aber der Fallback existiert (`fallback_key_encrypted`), wird der Fallback verwendet
- Dies unterstuetzt die Schluesselrotation

## Sicherheit

- Alle API-Schluessel sind **im Ruhezustand verschluesselt** mit AES-256-GCM
- Die Entschluesselung erfolgt **nur im Arbeitsspeicher** fuer API-Aufrufe
- `getAllPlatformConfigs()` ist auf interne Endpoints beschraenkt — niemals oeffentlich zugaenglich
- Maskierte Schluessel (Format `sk-*****XXXX`) werden in allen Admin-Antworten verwendet

## Verwalteter Tier Integration

Die Funktion `getUserAIModel()` behandelt den Tier-basierten Fallback:

1. Wenn der Benutzer eine eigene KI-Konfiguration hat, wird sie verwendet (alle Tiers)
2. Wenn keine Benutzerkonfig und Workspace auf `managed_payg` Tier, Fallback auf `getPlatformAIModel()`
3. Wenn keine Benutzerkonfig und Workspace auf `byo_keys` Tier, gibt null zurueck
