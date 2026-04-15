# Comment ajouter une clé de traduction

## Vue d'ensemble

WhyNot utilise **i18next** avec des fichiers JSON par namespace et par langue. Chaque clé doit exister dans toutes les langues supportées (en, ar, fr, de, es).

## Étapes

### 1. Ajouter la clé dans le fichier anglais (source)

Identifiez le namespace approprié et ajoutez la clé dans le fichier EN correspondant.

**Frontend** (`frontend/public/locales/en/`) :
- `common.json` — navigation, en-têtes, erreurs, onboarding
- `auth.json` — authentification, 2FA
- `dashboard.json` — projets, environnements, moniteurs, webhooks
- `runner.json` — exécuteur de tests, boucle QA, performance
- `results.json` — résultats, cas de test, régression visuelle
- `settings.json` — profil, organisation, clés API, notifications
- `billing.json` — forfaits, crédits, factures
- `landing.json` — page d'accueil marketing

**Admin** (`admin-frontend/public/locales/en/`) :
- `common.json` — navigation, tableau de bord, utilisateurs, organisations
- `admin.json` — feature flags, fournisseurs IA, facturation, audit
- `auth.json` — connexion administrateur
- `settings.json` — paramètres système
- `superadmin.json` — plans, abonnements, crédits

### 2. Ajouter la traduction française

Dans `frontend/public/locales/fr/<namespace>.json` (ou `admin-frontend/…`), ajoutez la même clé avec la traduction française.

**Règles** :
- Vouvoiement obligatoire (vous, votre, vos)
- Pas de casse de titre anglaise — majuscule uniquement au premier mot
- Espace insécable (`\u00a0`) avant `: ; ? !`
- Guillemets français : `«\u00a0texte\u00a0»`
- Conserver les placeholders : `{{variable}}`, `<tag>texte</tag>`
- Ne jamais traduire les noms de marque (WhyNot, Playwright, GitHub, etc.)

### 3. Ajouter dans toutes les autres langues

Répétez pour `ar`, `de`, `es`. Chaque langue doit avoir exactement les mêmes clés.

### 4. Vérifier avec les tests

```bash
# Frontend
cd frontend && npx vitest run src/__tests__/i18n-completeness.test.ts

# Admin
cd admin-frontend && npx vitest run src/__tests__/i18n-completeness.test.ts
```

Les tests vérifient :
- Parité des clés entre toutes les langues
- Aucune valeur vide pour les langues complètes (ar, fr)
- Aucune valeur identique à l'anglais (sauf cognats et noms de marque)
- Typographie française (NBSP avant la ponctuation double)
- Préservation des placeholders

## Glossaire de référence

| Anglais | Français |
|---------|----------|
| Dashboard | Tableau de bord |
| Sign in | Se connecter |
| Sign up | Créer un compte |
| Settings | Paramètres |
| Billing | Facturation |
| Test case | Cas de test |
| Test run | Exécution de test |
| Credits | Crédits |
| Workspace | Espace de travail |
| QA Loop | Boucle QA |
| Monitor | Moniteur |
| Plan | Forfait |
| Visual Regression | Régression visuelle |
| Screenshot | Capture d'écran |
| Feature flag | Feature flag |

## Typographie française

| Signe | Règle | Exemple JSON |
|-------|-------|-------------|
| `:` | NBSP avant | `"Statut\u00a0: actif"` |
| `;` | NBSP avant | `"Option A\u00a0; Option B"` |
| `?` | NBSP avant | `"Supprimer\u00a0?"` |
| `!` | NBSP avant | `"Succès\u00a0!"` |
| `«»` | NBSP à l'intérieur | `"«\u00a0texte\u00a0»"` |
