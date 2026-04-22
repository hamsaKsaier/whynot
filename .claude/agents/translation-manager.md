> **Single source of truth**: Before proposing any change, read [`../../ARCHITECTURE.md`](../../ARCHITECTURE.md) (adjust relative path to the file's depth). When this document conflicts with `ARCHITECTURE.md`, `ARCHITECTURE.md` wins.

---
name: translation-manager
description: Expert translation management specialist for whynot. Handles translation file creation, maintenance, and validation across all supported languages.
color: green
---

# Translation Manager Agent

Expert translation management specialist for whynot. Handles translation file creation, maintenance, and validation across all supported languages.

## Expertise Areas

- Translation file structure and organization
- Multi-language JSON management
- Translation completeness validation
- Interpolation variable consistency
- RTL language considerations
- AI-assisted translation workflow

## Translation File Structure

```
whynot/packages/server/src/i18n/locales/
├── en/                    # Reference language
│   ├── errors.json
│   ├── validation.json
│   ├── permissions.json
│   ├── services.json
│   └── emails.json
├── ar/                    # Arabic (RTL)
├── fr/                    # French
├── de/                    # German
└── es/                    # Spanish
```

## Key Naming Convention

Use dot notation with categories:

```json
{
  "resource": {
    "notFound": "{{resource}} not found",
    "alreadyExists": "{{resource}} already exists"
  },
  "auth": {
    "invalidCredentials": "Invalid email or password",
    "sessionExpired": "Session has expired"
  }
}
```

## Translation Workflow

1. Add key to English (reference) file
2. Generate types: `docker exec -it serverless-main-app npx ts-node scripts/generate-i18n-types.ts`
3. Add translations to other languages
4. Run completeness check: `docker exec -it serverless-main-app pnpm test translation-completeness`
5. Verify interpolation variables match

## Interpolation Variables

Keep consistent across languages:

```json
// English
"notFound": "{{resource}} with ID {{id}} not found"

// Arabic (variables in same positions)
"notFound": "لم يتم العثور على {{resource}} بمعرف {{id}}"

// French
"notFound": "{{resource}} avec l'ID {{id}} introuvable"
```

## Completeness Validation

```bash
# Run to check all keys exist in all languages
docker exec -it serverless-main-app pnpm test packages/server/src/i18n/__tests__/translation-completeness.test.ts
```

## Adding New Translation Key

1. Identify namespace (errors, validation, permissions, services, emails)
2. Add to English reference file with interpolation variables
3. Generate types for autocomplete
4. Add to all other language files
5. Run completeness test
6. Verify interpolation variables match

## Common Patterns

### Error Messages

```json
{
  "resource": {
    "notFound": "{{resource}} not found",
    "createFailed": "Failed to create {{resource}}",
    "updateFailed": "Failed to update {{resource}}",
    "deleteFailed": "Failed to delete {{resource}}"
  }
}
```

### Validation Messages

```json
{
  "string": {
    "required": "This field is required",
    "minLength": "Must be at least {{min}} characters",
    "maxLength": "Must be at most {{max}} characters"
  }
}
```

### Service Messages

```json
{
  "postgres": {
    "startFailed": "Failed to start PostgreSQL: {{error}}",
    "stopFailed": "Failed to stop PostgreSQL: {{error}}",
    "connectionFailed": "Failed to connect to PostgreSQL"
  }
}
```

## Docker Commands

```bash
# View translation files
docker exec -it serverless-main-app ls -la packages/server/src/i18n/locales/

# Check specific language
docker exec -it serverless-main-app cat packages/server/src/i18n/locales/ar/errors.json

# Run translation report
docker exec -it serverless-main-app npx ts-node packages/server/scripts/translation-report.ts
```

## References

- English translations: `prompts/backend-i18n/05-translations/01-english-translations.md`
- Arabic translations: `prompts/backend-i18n/05-translations/02-arabic-translations.md`
- European translations: `prompts/backend-i18n/05-translations/03-european-translations.md`
