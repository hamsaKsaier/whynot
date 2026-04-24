---
title: "Recon — Démarrage rapide"
description: "Lancez votre premier scan Recon en cinq minutes environ."
lang: fr
draft: false
---

# Démarrage rapide Recon

Lancez votre premier scan Recon en cinq minutes environ. Ce guide vous accompagne dans l'assistant de nouveau scan, de bout en bout, depuis l'autorisation jusqu'aux premiers résultats.

Avant de commencer :

- Vous devez être propriétaire de l'espace de travail ou disposer de la permission `recon.scan.create`.
- L'espace de travail doit avoir le drapeau `recon_enabled` activé. Demandez à votre administrateur si vous ne voyez pas la section Recon dans la barre latérale.
- Vous devez avoir le droit légal de scanner l'environnement cible. Lisez d'abord [Autorisation et utilisation responsable](responsible-use.md).

---

## Étape 1 — Ouvrir l'assistant de nouveau scan

1. Dans la barre latérale, cliquez sur **Recon**.
2. Sur la page d'accueil Recon, cliquez sur **Nouveau scan**.

L'assistant s'ouvre sur un flux à quatre étapes : **Cible → Autorisation → Portée → Vérification**.

## Étape 2 — Choisir votre cible

Remplissez le panneau cible :

| Champ | Ce qu'il faut saisir |
|-------|----------------------|
| **Environnement** | L'environnement à scanner. Les environnements étiquetés `production` affichent un avertissement visible — voir ci-dessous. |
| **URL de base** | L'URL racine d'où le scan démarre. Doit être `https://` dans la plupart des espaces de travail. |
| **Dépôt (optionnel)** | Liez un dépôt git connecté pour que Recon puisse raisonner sur votre code source en plus du site en production. |
| **Nom du scan** | Une étiquette courte. Par défaut : nom de l'environnement plus la date du jour. |

> **Avertissement production.** Si vous choisissez un environnement étiqueté `production`, Recon affiche un avertissement jaune. Recon exécutera quand même le scan — vous l'avez explicitement autorisé — mais assurez-vous de vouloir vraiment du trafic en direct et des sondes actives sur la production. En cas de doute, choisissez plutôt un environnement de staging ou de prévisualisation.

## Étape 3 — Confirmer l'autorisation

Chaque scan exige un enregistrement d'**autorisation par scan**. C'est une barrière légale, pas une fioriture UX : vous déclarez à la plateforme, par écrit, que vous avez la permission de scanner cette cible.

Dans le panneau d'autorisation :

1. Cochez **Je suis autorisé(e) à scanner cette cible.**
2. Cochez **Je comprends que ce scan enverra des sondes actives.**
3. Saisissez l'**entité juridique** que vous représentez (p. ex. le nom de votre entreprise).
4. Collez éventuellement une référence à votre autorisation écrite (ID de ticket, fil d'e-mails, contrat).

À la soumission, Recon écrit une ligne immuable dans le journal d'audit d'autorisation, liée à votre utilisateur, votre IP, l'horodatage et l'URL cible exacte. Vous pouvez la consulter ultérieurement dans **Paramètres → Recon → Journal d'audit**.

Si vous ne pouvez pas cocher les trois cases, arrêtez. Vous n'avez pas encore d'autorisation.

## Étape 4 — Choisir la portée

La portée contrôle l'ampleur et la profondeur du scan.

- **Scan de surface** — reconnaissance passive uniquement. Rapide, peu coûteux, sans sondage actif.
- **Scan standard** — scan de surface plus sondes actives pour les classes de vulnérabilités courantes. Recommandé pour la plupart des espaces de travail.
- **Scan approfondi** — scan standard plus sondage authentifié et budgets de crawl plus longs. Consomme le plus de crédits.

Chaque option affiche son coût estimé en crédits avant validation. Vous pouvez aussi définir un **plafond de crédits par scan** dans **Paramètres → Recon** ; les scans qui dépasseraient le plafond sont arrêtés avant le début de la prochaine phase payante.

## Étape 5 — Vérifier et lancer

Le dernier panneau résume tout : cible, autorisation, portée, coût estimé et avertissements éventuels. Lorsque vous cliquez sur **Lancer le scan**, Recon :

1. Écrit la ligne du scan.
2. Écrit la ligne d'autorisation.
3. Met le scan en file d'attente.
4. Vous redirige vers la page de détails du scan.

## Et ensuite

- La page de détails du scan se met à jour en temps réel à mesure que chaque phase se termine.
- Quand le scan se termine, les résultats apparaissent sous l'onglet **Résultats**.
- Chaque résultat inclut une note de gravité, une preuve de concept et une remédiation recommandée. Voir [Comprendre les résultats](understanding-findings.md).
- Les rapports peuvent être partagés et exportés en PDF. Voir [Lire les rapports](reading-reports.md).

## Vous avez terminé

À partir d'ici, lisez :

- [Autorisation et utilisation responsable](responsible-use.md) — vos obligations légales.
- [Comprendre les résultats](understanding-findings.md) — comment lire la gravité, les issues d'exploitation et les indicateurs de faux positifs.
- [Quotas et facturation](quotas.md) — combien coûte un scan sur chaque plan.
- [Dépannage](troubleshooting.md) — quand un scan se bloque ou échoue.
