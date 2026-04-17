---
title: "Internationalisation (i18n)"
description: "Vue d'ensemble de l'architecture d'internationalisation de WhyNot QA avec support de 5 langues."
lang: fr
draft: true
---

# Internationalisation (i18n)

WhyNot QA prend en charge 5 langues : anglais, arabe, francais, allemand et espagnol.

## Architecture

- **Bibliotheque :** [react-i18next](https://react.i18next.com/) v15 + i18next v23
- **Backend :** `i18next-http-backend` charge les traductions depuis `/locales/{lang}/{namespace}.json`
- **Detection :** `i18next-browser-languagedetector` verifie localStorage > navigateur > attribut lang du HTML
- **RTL :** L'arabe definit `dir="rtl"` sur `<html>` via LanguageSwitcher
- **Langue de repli :** L'anglais (`en`) est la langue de repli

## Fichiers de locale

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

admin-frontend/public/locales/
  en/    ar/    fr/    de/    es/
    common.json
    admin.json
    auth.json
    settings.json
    superadmin.json
```

## Guides

- [Comment ajouter une cle de traduction](./how-to-add-a-translation-key.md)

## Ajout de nouvelles cles au namespace runner

Le namespace `runner` contient toutes les chaines de l'interface de l'executeur de tests, y compris le texte du verdict de performance. Lors de l'ajout de nouvelles cles, suivez le modele d'interpolation utilise par les cles de verdict comme exemple :

```json
{
  "runner.performance.verdict.okLatency": "Handled {{rps}} req/s with an average latency of {{avgMs}} ms.",
  "runner.performance.verdict.highErrorRate": "{{errorPct}}% of requests failed."
}
```

Consultez [Localisation des tests de performance](../testing/performance.md) pour la liste complete des cles de verdict et leurs variables d'interpolation.

## Localisation du backend

L'API gateway est entierement localisee. Toutes les reponses API respectent l'en-tete `Accept-Language` envoye par le client.

### Le contrat `Accept-Language`

Chaque reponse API renvoie des messages d'erreur et de succes localises en fonction de l'en-tete `Accept-Language` de la requete. Valeurs supportees : `en`, `ar`, `fr`, `de`, `es`. Si l'en-tete est absent ou contient un locale non reconnu, l'API utilise `en` par defaut.

### Fonctionnement de `req.t()`

Le middleware i18n situe dans `gateway/src/middleware/i18n.ts` analyse l'en-tete `Accept-Language`, initialise un traducteur par requete et l'attache sous `req.t()`. Utilisation dans les gestionnaires de route :

```typescript
// Simple key lookup
req.t('errors:auth.unauthorized')

// With interpolation
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

Chaque sous-repertoire contient les memes fichiers de namespace. Chaque cle presente dans `en/` doit exister dans tous les autres repertoires de langue.

### Ajouter une nouvelle cle d'erreur ou de succes

1. Ajoutez la cle dans `en/{namespace}.json` (ex. `en/errors.json`).
2. Ajoutez la traduction correspondante dans les fichiers `ar/`, `fr/`, `de/` et `es/` pour le meme namespace.
3. Utilisez `req.t('namespace:key')` dans le gestionnaire de route :
   ```typescript
   res.status(403).json({
     error: { code: 'auth.forbidden', message: req.t('errors:auth.forbidden') }
   });
   ```
4. Pour les fonctions utilitaires sans acces a `req`, utilisez `createError` avec la cle i18n :
   ```typescript
   createError(msg, code, status, details, 'errors:auth.forbidden')
   ```
5. Lancez le test `i18n-backend-completeness.test.ts` pour verifier que toutes les langues contiennent la nouvelle cle.

### Localisation des modeles d'e-mail

Les modeles d'e-mail utilisent `i18n.getFixedT(recipientLocale, 'emails')` pour traduire le contenu. Le locale provient de la preference de langue enregistree de l'utilisateur (enregistrement utilisateur), et non de l'en-tete `Accept-Language` de la requete. Cela garantit que les utilisateurs recoivent les e-mails dans leur langue preferee, quel que soit le client ayant declenche l'action.

### Format de reponse d'erreur

Les erreurs API suivent l'un des deux formats :

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

La valeur `message` / `error` est toujours localisee en fonction de l'en-tete `Accept-Language` de la requete (ou du locale enregistre de l'utilisateur pour les e-mails).

## Tests

- `i18n-completeness.test.ts` valide la coherence de l'arbre de cles dans toutes les langues
- `i18n-no-hardcoded-strings.test.ts` recherche les litteraux anglais non traduits dans les composants de page
- `i18n.test.ts` valide la configuration i18n (langues, RTL, metadonnees)

## Configuration

- Frontend : `frontend/src/i18n.ts`
- Admin : `admin-frontend/src/i18n.ts`
- Selecteur de langue : `frontend/src/components/LanguageSwitcher.tsx`

## Test de la couverture i18n

### Ajouter une nouvelle page au manifeste

Chaque page visible par l'utilisateur doit etre enregistree dans `pages-manifest.ts` :

- **Frontend :** `frontend/src/__tests__/pages-manifest.ts`
- **Admin :** `admin-frontend/src/__tests__/pages-manifest.ts`

Ajoutez une entree avec `key`, `path`, `routePattern`, `component` et `requiresAuth`. La suite `pages-i18n.test.tsx` itere sur ce manifeste x 5 locales.

### Fonctionnement du scanneur de fuites anglaises

Pour les locales non anglophones, le test analyse `document.body.innerText` a la recherche de sequences ASCII-Latin de 4 caracteres ou plus (`/\b[A-Za-z]{4,}\b/`). Toute correspondance absente de la liste blanche de marques partagee (`shared/constants/brand-allowlist.ts`) est signalee comme chaine potentiellement non traduite.

Pour l'arabe specifiquement, le test verifie en outre qu'au moins un caractere arabe (`[\u0600-\u06FF]`) est present dans la sortie rendue.

### Ajouter un nouveau routeur de gateway au test d'integration

Editez `gateway/src/__tests__/api/i18n-integration.test.ts` :

1. Ajoutez des routes de test qui exercent `req.t()` avec les cles de traduction concernees.
2. Ajoutez des cas de test dans le bloc describe pour chaque langue.
3. Incluez des tests de repli (en-tete `Accept-Language` inconnu ou absent).

### Deboguer un test page-locale en echec

1. Lancez le test specifique : `make shell-frontend npx vitest run --reporter=verbose src/__tests__/pages-i18n.test.tsx`
2. Consultez le message d'erreur — il liste les mots latins non traduits trouves.
3. Si le mot est un cognat legitime ou un nom de marque, ajoutez-le a `shared/constants/brand-allowlist.ts`.
4. Si le mot est du texte d'interface non traduit, ajoutez la cle de traduction manquante au fichier JSON du locale.
5. Si la page ne s'affiche pas, verifiez que toutes ses dependances sont simulees (mocked) dans `pages-i18n.test.tsx`.

### Lancer les tests

```bash
make test                 # all packages
make test-frontend        # frontend only
make test-admin           # admin-frontend only
make test-backend         # gateway only
```
