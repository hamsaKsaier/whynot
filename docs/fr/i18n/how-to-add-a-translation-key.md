---
title: "Comment ajouter une cle de traduction"
description: "Guide complet pour ajouter une nouvelle chaine traduisible dans WhyNot QA."
lang: fr
draft: false
---

# Comment ajouter une cle de traduction

Ce guide presente le flux complet pour ajouter une nouvelle chaine traduisible dans WhyNot QA.

## 1. Choisir le bon namespace

Chaque namespace correspond a une zone fonctionnelle. Choisissez celui qui convient :

| Namespace | Portee |
|-----------|--------|
| `common` | Flux d'authentification, limite d'erreur, libelles globaux, feature flags |
| `auth` | Authentification a deux facteurs |
| `dashboard` | Projets, environnements, moniteurs, integrations, page d'accueil |
| `runner` | Executeur de tests, boucle QA, controles d'execution, activite de l'agent |
| `results` | Resultats de tests, cas de test, executions de tests, artefacts |
| `settings` | Profil, organisation, espace de travail, cles API, notifications, fournisseurs IA, utilisation, zone de danger |
| `billing` | Forfaits, credits, factures, checkout, PAYG |
| `landing` | Pages marketing (hero, fonctionnalites, tarifs, FAQ, pied de page) |

**Namespaces admin-frontend :** `common`, `admin`, `auth`, `settings`, `superadmin`.

### Arbre de decision du namespace

1. La chaine est-elle reutilisee dans 3+ fonctionnalites ? -> `common`
2. Est-ce une chaine auth/login/inscription ? -> `common` (sous le prefixe `auth.*`)
3. Est-ce une chaine du runner de test, QA Loop, ou execution ? -> `runner`
4. Est-ce une chaine de projet, environnement, moniteur ou integration ? -> `dashboard`
5. Est-ce une chaine de resultat de test, cas de test ou artefact ? -> `results`
6. Est-ce une chaine parametres/profil/organisation/cle API ? -> `settings`
7. Est-ce une chaine facturation, forfait, credit ou checkout ? -> `billing`
8. Est-ce une chaine de page d'accueil/marketing ? -> `landing`
9. Est-ce une chaine d'authentification a deux facteurs ? -> `auth`

## 2. Nommer la cle

Les cles utilisent le **camelCase avec des separateurs par points**. Convention :

- **Noms** pour les libelles statiques : `settings.profile.name`
- **Verbes** pour les actions : `settings.profile.save`
- **Adjectifs** pour les etats : `runner.status.running`
- Grouper par fonctionnalite : `auth.login.title`, `auth.login.emailLabel`, `auth.login.submit`

Exemples :
```
dashboard.projects.title        -> "Projects"
dashboard.projects.create       -> "New Project"
dashboard.projects.empty.title  -> "No projects yet"
billing.credits.buy             -> "Buy Credits"
runner.controls.pause           -> "Pause"
```

## 3. Ajouter la valeur anglaise

Ouvrez le fichier JSON appropriate sous `frontend/public/locales/en/` (ou `admin-frontend/public/locales/en/`).

```json
{
  "dashboard.projects.title": "Projects",
  "dashboard.projects.create": "New Project",
  "dashboard.projects.empty.title": "No projects yet"
}
```

Regles :
- Cles triees par ordre alphabetique pour la stabilite des diffs.
- Pas de virgules finales.
- Encodage UTF-8, fins de ligne LF.
- `landing.json` utilise des cles imbriquees ; tous les autres fichiers utilisent des cles plates.

## 4. Utiliser la cle dans un composant

### Composants fonctionnels

```tsx
import { useTranslation } from "react-i18next"

export function ProjectsPage() {
  const { t } = useTranslation("dashboard")

  return <h1>{t("dashboard.projects.title")}</h1>
}
```

### Chaines avec elements integres (liens, gras)

```tsx
import { Trans } from "react-i18next"

<Trans
  i18nKey="auth.signup.acceptTerms"
  ns="common"
  components={{
    termsLink: <a href="/terms" className="text-primary underline" />,
    privacyLink: <a href="/privacy" className="text-primary underline" />,
  }}
/>
```

Valeur JSON : `"I agree to the <termsLink>Terms of Service</termsLink> and <privacyLink>Privacy Policy</privacyLink>"`

### Interpolation

```tsx
t("dashboard.welcome", { name: user.name })
// JSON: "Welcome back, {{name}}"

t("runner.progress", { current: 3, total: 10 })
// JSON: "Step {{current}} of {{total}}"
```

**Regles de nommage des placeholders :**
- Utilisez systematiquement le **camelCase** : `{{userName}}`, et non `{{user_name}}`
- Gardez les noms courts mais descriptifs : `{{count}}`, `{{name}}`, `{{error}}`
- Utilisez le meme nom de placeholder dans toutes les langues pour la meme variable
- Chaque fichier de langue doit contenir exactement les memes `{{placeholders}}` que l'anglais

### Pluriels

i18next gere les formes plurielles via `{{count}}`. Pour les langues avec des regles de pluriel complexes (comme l'arabe avec ses 6 formes), utilisez les suffixes `_zero`, `_one`, `_two`, `_few`, `_many`, `_other` :

```json
// en/common.json
{
  "common.items": "{{count}} item",
  "common.items_plural": "{{count}} items"
}

// ar/common.json (Arabic has 6 plural forms)
{
  "common.items_zero": "لا عناصر",
  "common.items_one": "عنصر واحد",
  "common.items_two": "عنصران",
  "common.items_few": "{{count}} عناصر",
  "common.items_many": "{{count}} عنصرًا",
  "common.items_other": "{{count}} عنصر"
}
```

Utilisation dans les composants :
```tsx
t("common.items", { count: items.length })
```

### Messages de validation Zod

Creez les schemas a l'interieur du composant ou utilisez une fonction fabrique :

```tsx
function createLoginSchema(t: (key: string) => string) {
  return z.object({
    email: z.string().email(t("auth.common.emailValidation")),
    password: z.string().min(8, t("auth.common.passwordMinLength")),
  })
}

export function LoginPage() {
  const { t } = useTranslation("common")
  const loginSchema = createLoginSchema(t)
  // ...
}
```

### Messages toast / notification

Appelez toujours `t()` au moment de l'appel, pas au chargement du module :

```tsx
// Correct
toast.success(t("dashboard.projects.createSuccess"))

// Wrong - t() called at module load, won't update on language change
const MSG = t("dashboard.projects.createSuccess")
toast.success(MSG)
```

### Composants de classe (ErrorBoundary)

Utilisez le HOC `withTranslation` :

```tsx
import { withTranslation, WithTranslation } from "react-i18next"

class ErrorBoundaryInner extends React.Component<Props & WithTranslation> {
  render() {
    const { t } = this.props
    return <h1>{t("error.boundary.title")}</h1>
  }
}

export const ErrorBoundary = withTranslation("common")(ErrorBoundaryInner)
```

## 5. Ajouter les stubs pour les autres langues

Apres avoir ajoute les cles anglaises, synchronisez l'arbre de cles vers les autres langues :

```bash
node scripts/sync-locale-stubs.js
```

Cela ajoute des valeurs de chaine vides pour toutes les nouvelles cles dans les fichiers `ar`, `fr`, `de`, `es`.

## 6. Lancer la validation

```bash
# Type checking
make shell-client npm run typecheck

# Linting  
make shell-client npm run lint

# i18n tests
make test-frontend

# RTL layout validation
make rtl-check
```

Le test `i18n-completeness` verifie :
- Les 5 langues ont les memes fichiers de namespace.
- Tous les namespaces ont des arbres de cles identiques dans toutes les langues.
- Toutes les valeurs anglaises sont non vides.
- Les valeurs traduites (lorsqu'elles sont presentes) different de l'anglais.

Le test `i18n-no-hardcoded-strings` scanne **tous** les fichiers de composants et de pages (`src/**/*.{ts,tsx}`) a la recherche de litteraux anglais qui devraient utiliser `t()`. Il verifie :
- Le contenu texte JSX (ex. `>Du texte<`)
- Les props contenant du texte : `title`, `placeholder`, `aria-label`, `alt`
- Les messages toast : `toast.error("...")`, `toast.success("...")`
- Les messages de validation Zod : `.min(3, "Doit être...")`

Les nouvelles PRs **doivent** garder les tests `i18n-completeness` et `i18n-no-hardcoded-strings` au vert.

## Localisation du backend

L'API gateway est aussi localisee. Consultez la [vue d'ensemble i18n](./index.md#localisation-du-backend) pour tous les details. Les points cles pour ajouter des cles de traduction backend :

### Le contrat `Accept-Language`

Toutes les reponses API respectent l'en-tete `Accept-Language`. Valeurs supportees : `en`, `ar`, `fr`, `de`, `es`. Repli vers `en` si non reconnu.

### Fonctionnement de `req.t()`

Le middleware i18n situe dans `gateway/src/middleware/i18n.ts` analyse l'en-tete `Accept-Language` et attache `req.t()`. Utilisation :

```typescript
req.t('errors:auth.unauthorized')
req.t('success:admin.planUpdated', { planName })
```

### Emplacement des traductions backend

```
gateway/src/i18n/translations/
  en/    ar/    fr/    de/    es/
    errors.json
    success.json
    validation.json
    emails.json
    billing.json
```

### Ajouter une nouvelle cle backend (etape par etape)

1. Ajoutez la cle dans `en/{namespace}.json`.
2. Ajoutez les traductions dans les fichiers `ar`, `fr`, `de`, `es` pour le meme namespace.
3. Utilisez `req.t('namespace:key')` dans le gestionnaire.
4. Pour les fonctions utilitaires sans `req`, utilisez `createError(msg, code, status, details, 'errors:key')`.
5. Lancez `i18n-backend-completeness.test.ts` pour verifier que toutes les langues contiennent la cle.

### Localisation des modeles d'e-mail

Utilise `i18n.getFixedT(recipientLocale, 'emails')`. Le locale provient de l'enregistrement utilisateur, pas de l'en-tete de la requete.

### Format de reponse d'erreur

```json
{
  "error": {
    "code": "auth.invalidCredentials",
    "message": "<chaine localisee>"
  }
}
```

ou :

```json
{
  "success": false,
  "error": "<chaine localisee>"
}
```

## Checklist

Avant de soumettre une PR avec de nouvelles cles de traduction :

- [ ] Cle ajoutee au bon fichier JSON de namespace
- [ ] La valeur anglaise est non vide et descriptive
- [ ] Le composant utilise le hook `useTranslation()` avec le bon namespace
- [ ] Toutes les chaines visibles par l'utilisateur utilisent `t()` (libelles, placeholders, titres, aria-labels, messages de validation, toasts)
- [ ] L'interpolation utilise la syntaxe `{{variable}}`
- [ ] Les elements integres utilisent le composant `<Trans>`
- [ ] Les stubs de locale sont synchronises pour les autres langues
- [ ] Le test `i18n-completeness` passe
- [ ] Le test `i18n-no-hardcoded-strings` passe
