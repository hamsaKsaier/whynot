# Architecture du système de Feature Flags

## Modèle à deux tables

Le système de feature flags utilise deux tables de base de données :

### `feature_flags` — Définitions globales des drapeaux

| Colonne | Type | Description |
|---------|------|-------------|
| `key` | `text` (PK) | Identifiant en snake_case, correspond au registre |
| `name` | `text` | Nom lisible par l'humain |
| `description` | `text` | Ce que le drapeau contrôle |
| `default_enabled` | `boolean` | État par défaut pour les nouvelles organisations |
| `rollout_percent` | `integer` | Pourcentage de déploiement (0–100) |
| `created_at` | `timestamptz` | Date de création |
| `updated_at` | `timestamptz` | Dernière modification |

### `organization_feature_flags` — Substitutions par organisation

| Colonne | Type | Description |
|---------|------|-------------|
| `organization_id` | `uuid` (PK, FK) | Référence vers `organizations(id)` |
| `flag_key` | `text` (PK, FK) | Référence vers `feature_flags(key)` |
| `enabled` | `boolean` | Valeur substituée pour cette organisation |
| `set_by` | `uuid` (FK) | Administrateur qui a défini la substitution |
| `set_at` | `timestamptz` | Date de la substitution |

## Le registre comme source de vérité

Toutes les clés de drapeaux valides sont définies dans `shared/constants/platform-features.ts`. Ce registre :

- Exporte `PLATFORM_FEATURES` — un objet constant associant les clés aux valeurs snake_case en DB
- Exporte `PlatformFeatureKey` — le type union de toutes les clés valides
- Exporte `isValidFeatureKey()` — un type guard pour la validation à l'exécution
- Exporte `ALL_PLATFORM_FEATURE_KEYS` — tableau de toutes les clés valides

## Ordre de résolution d'un drapeau

1. Vérifier `organization_feature_flags` pour une substitution spécifique à l'organisation
2. Si pas de substitution, utiliser `feature_flags.default_enabled`
3. Si `rollout_percent > 0` et pas de substitution, utiliser un hash déterministe de `org_id + flag_key`

## Ajouter un nouveau drapeau

1. Ajouter la clé dans `PLATFORM_FEATURES` dans `shared/constants/platform-features.ts`
2. Ajouter une entrée de seed dans `shared/database/seeds/feature-flags.ts`
3. Exécuter le script de seed — il est idempotent (`ON CONFLICT ... DO UPDATE`)
4. Utiliser `isValidFeatureKey()` aux frontières API pour valider les clés entrantes

## Audit

Chaque mutation de drapeau s'écrit dans la table `audit_log`.
