---
title: "Recon — Exemple de rapport"
description: "Un exemple expurgé d'un rapport de scan Recon."
lang: fr
draft: false
---

# Exemple de rapport

Voici un exemple expurgé d'un vrai rapport de scan Recon. Les URLs, paramètres et réponses ont été modifiés pour protéger la cible originale. La structure, le barème de gravité et le format de la preuve de concept correspondent exactement à ce que vous verrez pour vos propres scans.

Pour une explication de chaque section, voir [Lire les rapports](reading-reports.md).

---

## Scan : example-staging.acme.dev

| Champ | Valeur |
|-------|--------|
| **Cible** | `https://example-staging.acme.dev` |
| **Environnement** | `staging` |
| **Portée** | Standard |
| **Démarré** | 2026-04-22 14:02 UTC |
| **Terminé** | 2026-04-22 14:31 UTC |
| **Lancé par** | engineer@acme.dev |
| **Référence d'autorisation** | INT-4421 (ticket pentest interne) |

---

## 1. Résumé

Un scan standard de `example-staging.acme.dev` s'est terminé en 29 minutes et a produit **un résultat critique**, **deux résultats élevés** et **quatre résultats moyens** confirmés, plus onze entrées faibles/info.

Le résultat critique est une injection SQL dans l'endpoint `/api/v1/orders` qui permet à un attaquant non authentifié de lire des lignes arbitraires des tables `orders` et `customers`. **Traitez-le comme un incident.**

Les deux résultats élevés sont un problème de contrôle d'accès défaillant sur `/admin/users` et un XSS stocké dans le champ notes de commande ; les deux nécessitent un compte à privilèges réduits pour être exploités.

Comparé au scan précédent (2026-03-15), l'injection SQL critique est **nouvelle**. Trois résultats précédemment élevés sont maintenant marqués **corrigés**.

---

## 2. Aperçu des risques

| Gravité | Ce scan | Scan précédent | Évolution |
|---------|---------|----------------|-----------|
| Critique | 1 | 0 | +1 |
| Élevée | 2 | 5 | -3 |
| Moyenne | 4 | 4 | 0 |
| Faible | 7 | 9 | -2 |
| Info | 4 | 3 | +1 |

---

## 3. Résultats (extrait)

### Résultat 1 — Injection SQL dans `/api/v1/orders`

| Champ | Valeur |
|-------|--------|
| **Gravité** | Critique |
| **Classe** | Injection SQL (CWE-89) |
| **Cible** | `GET /api/v1/orders?status=<param>` |
| **Confiance** | Élevée |
| **Issue d'exploitation** | Lecture confirmée |

**Ce qui s'est passé.** Le paramètre de requête `status` sur `/api/v1/orders` est concaténé dans une clause SQL `WHERE` sans paramétrage. Un attaquant peut sortir du contexte chaîne et injecter du SQL arbitraire. Aucune authentification requise.

**Preuve de concept.**

```http
GET /api/v1/orders?status=open'%20UNION%20SELECT%20[REDACTED]%20--%20 HTTP/1.1
Host: example-staging.acme.dev

HTTP/1.1 200 OK
Content-Type: application/json

{"orders":[{"id":1,"status":"[REDACTED-RESPONSE]"}]}
```

La clause `UNION` injectée a renvoyé des données d'une autre table, confirmant l'injection. La charge utile réelle et la réponse ont été expurgées dans cet exemple.

**Pourquoi c'est important.** Un attaquant non authentifié peut lire chaque ligne de toute table à laquelle l'utilisateur de base de données a accès, y compris les tables `customers` et `orders`. C'est la classe de vulnérabilité à plus fort impact contre une base de données d'application web typique.

**Remédiation recommandée.** Remplacez la concaténation de chaîne par des requêtes paramétrées dans le handler de `/api/v1/orders`. Le même chemin de code existe probablement dans des endpoints adjacents — auditez le fichier. Voir OWASP A03:2021 — Injection pour des conseils généraux.

**Références.**

- CWE-89 : Neutralisation incorrecte des éléments spéciaux utilisés dans une commande SQL.
- OWASP Top 10 2021 : A03 — Injection.

---

### Résultat 2 — Contrôle d'accès défaillant sur `/admin/users`

| Champ | Valeur |
|-------|--------|
| **Gravité** | Élevée |
| **Classe** | Contrôle d'accès défaillant (CWE-285) |
| **Cible** | `GET /admin/users/{id}` |
| **Confiance** | Élevée |
| **Issue d'exploitation** | Lecture confirmée |

**Ce qui s'est passé.** L'endpoint `/admin/users/{id}` vérifie que le demandeur est connecté mais ne vérifie pas qu'il a le rôle `admin`. Tout utilisateur authentifié peut lire le profil de tout autre utilisateur, y compris l'e-mail et le rôle.

**Preuve de concept.** Une requête authentifiée standard depuis un compte non-admin a renvoyé le profil complet d'un autre utilisateur. Requête et réponse expurgées.

**Remédiation recommandée.** Ajoutez une vérification de rôle au handler de route. Auditez tous les endpoints `/admin/*` pour la même lacune.

---

### Résultat 3 — XSS stocké dans les notes de commande

| Champ | Valeur |
|-------|--------|
| **Gravité** | Élevée |
| **Classe** | XSS stocké (CWE-79) |
| **Cible** | `POST /api/v1/orders/{id}/notes` |
| **Confiance** | Élevée |
| **Issue d'exploitation** | Lecture confirmée |

**Ce qui s'est passé.** Le champ `notes` sur une commande est stocké sans assainissement et rendu en HTML sur la page de détails de commande. Un utilisateur à privilèges réduits peut injecter un script qui s'exécute lorsqu'un admin consulte la commande.

**Preuve de concept.** Une charge utile `<script>` (expurgée) a été stockée et observée s'exécutant dans une session séparée.

**Remédiation recommandée.** Rendez `notes` comme texte, pas HTML. Si du texte enrichi est requis, utilisez un assainisseur vérifié avec une liste blanche stricte.

---

*(Six résultats supplémentaires omis dans cet exemple.)*

---

## 4. Périmètre et méthodologie

- **Dans le périmètre.** `https://example-staging.acme.dev/*` — 47 endpoints découverts, 312 paramètres testés.
- **Hors périmètre.** Tous les autres hôtes ; l'arbre de chemin `/internal-debug/*` (selon la configuration de l'environnement).
- **Autorisation.** Ticket pentest interne INT-4421, signé par le propriétaire de l'environnement de staging.
- **Niveau de portée.** Standard — scan de surface plus sondes actives pour les classes OWASP-Top-10.

---

## 5. Lacunes de couverture

- **Chemins admin authentifiés.** Recon a reçu un compte de test à privilèges réduits mais pas de compte admin. Les résultats sur `/admin/*` sont limités aux problèmes qu'un non-admin authentifié peut atteindre.
- **Limitation de débit WAF.** Trois endpoints sous `/api/v1/billing/*` ont renvoyé `429 Too Many Requests` après 12 sondes chacun. Le crawl a sauté les paramètres restants.
- **Tâches d'arrière-plan.** Recon ne sollicite pas les files d'attente de tâches asynchrones ou les tâches planifiées. Les problèmes ne se manifestant qu'en traitement d'arrière-plan sont hors périmètre.

---

## 6. Piste d'audit

| Phase | Démarrée | Terminée | Notes |
|-------|----------|----------|-------|
| Reconnaissance | 14:02 | 14:08 | 47 endpoints découverts. |
| Analyse de surface | 14:08 | 14:14 | TLS, en-têtes, chemins exposés. |
| Sondage actif | 14:14 | 14:28 | 312 paramètres testés. |
| Confirmation | 14:28 | 14:30 | 7 résultats candidats ; 7 confirmés. |
| Rapport | 14:30 | 14:31 | Rapport rédigé. |

**Enregistrement d'autorisation.** Utilisateur `engineer@acme.dev`, IP `198.51.100.42`, enregistré 2026-04-22 14:01:53 UTC, cible `https://example-staging.acme.dev`, portée `standard`, référence `INT-4421`.

---

Pages liées :

- [Lire les rapports](reading-reports.md) — ce que signifie chaque section.
- [Comprendre les résultats](understanding-findings.md) — barème de gravité.
- [Démarrage rapide](quickstart.md) — lancez votre propre scan.
