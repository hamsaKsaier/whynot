# Documentation française — WhyNot QA

## Internationalisation (i18n)

- [Comment ajouter une clé de traduction](i18n/how-to-add-a-translation-key.md)

## État de la traduction

| Composant | Langues complètes | Namespaces |
|-----------|-------------------|------------|
| Frontend | en, ar, fr | 8 (common, auth, dashboard, runner, results, settings, billing, landing) |
| Admin | en, ar, fr | 5 (common, admin, auth, settings, superadmin) |

## Conventions

- **Registre** : français formel (vouvoiement), adapté au B2B SaaS
- **Terminologie** : français de France (pas québécois)
- **Typographie** : espace insécable avant `: ; ? !`, guillemets français `«\u00a0»`
- **Dates** : format `fr-FR` via `Intl.DateTimeFormat` (ex. 15 avril 2026)
- **Nombres** : séparateur de milliers = espace insécable, décimale = virgule (1 234,56)

## Validation

```bash
# Tests de complétude et typographie
cd frontend && npx vitest run src/__tests__/i18n-completeness.test.ts
cd admin-frontend && npx vitest run src/__tests__/i18n-completeness.test.ts
```
