# Feature-Flag-Architektur

## Zwei-Tabellen-Modell

Das Feature-Flag-System verwendet zwei Datenbanktabellen:

### `feature_flags` — Globale Flag-Definitionen

| Spalte | Typ | Beschreibung |
|--------|-----|--------------|
| `key` | `text` (PK) | Snake_case-Bezeichner, entspricht dem Register |
| `name` | `text` | Menschenlesbarer Anzeigename |
| `description` | `text` | Was das Flag steuert |
| `default_enabled` | `boolean` | Standardzustand für neue Organisationen |
| `rollout_percent` | `integer` | Rollout-Prozentsatz (0–100) |
| `created_at` | `timestamptz` | Erstellungszeitpunkt |
| `updated_at` | `timestamptz` | Letzte Änderung |

### `organization_feature_flags` — Organisationsspezifische Überschreibungen

| Spalte | Typ | Beschreibung |
|--------|-----|--------------|
| `organization_id` | `uuid` (PK, FK) | Verweis auf `organizations(id)` |
| `flag_key` | `text` (PK, FK) | Verweis auf `feature_flags(key)` |
| `enabled` | `boolean` | Überschriebener Wert für diese Organisation |
| `set_by` | `uuid` (FK) | Administrator, der die Überschreibung gesetzt hat |
| `set_at` | `timestamptz` | Zeitpunkt der Überschreibung |

## Register als Single Source of Truth

Alle gültigen Flag-Schlüssel sind in `shared/constants/platform-features.ts` definiert. Dieses Register:

- Exportiert `PLATFORM_FEATURES` — ein konstantes Objekt, das Enum-Schlüssel auf snake_case-DB-Werte abbildet
- Exportiert `PlatformFeatureKey` — den Union-Typ aller gültigen Schlüssel
- Exportiert `isValidFeatureKey()` — einen Type Guard für Laufzeitvalidierung
- Exportiert `ALL_PLATFORM_FEATURE_KEYS` — Array aller gültigen Schlüssel

## Flag-Auflösungsreihenfolge

1. `organization_feature_flags` auf organisationsspezifische Überschreibung prüfen
2. Wenn keine Überschreibung vorhanden, `feature_flags.default_enabled` verwenden
3. Wenn `rollout_percent > 0` und keine Überschreibung, deterministischen Hash von `org_id + flag_key` verwenden

## Neues Flag hinzufügen

1. Schlüssel zu `PLATFORM_FEATURES` in `shared/constants/platform-features.ts` hinzufügen
2. Seed-Eintrag in `shared/database/seeds/feature-flags.ts` hinzufügen
3. Seed-Skript ausführen — es ist idempotent (`ON CONFLICT ... DO UPDATE`)
4. `isValidFeatureKey()` an API-Grenzen zur Validierung eingehender Schlüssel verwenden

## Audit

Jede Flag-Mutation wird in die `audit_log`-Tabelle geschrieben.
