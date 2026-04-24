---
title: "Recon — Intégration CI"
description: "Déclenchez des scans Recon depuis votre pipeline CI. Bientôt disponible."
lang: fr
draft: false
---

# Intégration CI

> **Bientôt disponible.** Les scans déclenchés par CI sont sur la feuille de route. La forme de l'intégration est décrite ci-dessous ; l'API n'est pas encore stable.

L'objectif de l'intégration CI est de vous permettre de lancer automatiquement un scan Recon lorsqu'un déploiement atterrit dans un environnement non-production, puis d'afficher les résultats sur la pull request qui a déclenché le déploiement.

---

## Forme prévue

Un workflow typique :

1. Votre pipeline CI déploie un build dans un environnement de staging ou de prévisualisation.
2. Le pipeline appelle un webhook Recon avec l'URL de l'environnement, le SHA du commit et un jeton d'autorisation par exécution.
3. Recon lance un scan, dont la portée est limitée à l'URL de l'environnement.
4. À la fin du scan, Recon poste un résumé sur la pull request : nombre par gravité, diff par rapport au scan précédent et lien vers le rapport complet.
5. Si un résultat critique ou élevé est introduit (c'est-à-dire qu'il n'était pas dans le scan précédent), la vérification CI échoue. Les résultats existants ne bloquent pas.

L'autorisation est par exécution, pas par pipeline : le jeton CI représente un propriétaire d'espace de travail qui a pré-autorisé les scans contre une liste blanche spécifique d'URLs d'environnement. Les scans contre toute autre URL exigent une nouvelle autorisation interactive via l'assistant.

## Pourquoi ce n'est pas encore livré

L'intégration CI multiplie la surface de la barrière d'autorisation par scan, et se tromper là-dessus saperait toute l'histoire de l'utilisation responsable. Nous travaillons sur :

- Comment un jeton CI peut attester de l'autorisation sans être un secret à longue durée de vie chez votre fournisseur CI.
- Comment gérer les prévisualisations de déploiement où l'URL change par pull request.
- Comment échouer en sécurité quand le fournisseur CI ne supporte pas le blocage sur le statut d'une vérification.

Nous préférons livrer cela une fois plutôt que deux.

## Devenez bêta-testeur

Si vous voulez un accès anticipé, inscrivez-vous ci-dessous. Nous vous contacterons quand l'API sera assez stable pour s'y engager.

> **Inscription bêta :** envoyez un e-mail à `recon-beta@` votre domaine d'espace de travail, ou ouvrez le panneau Recon → Paramètres → CI et cliquez sur **Rejoindre la liste d'attente CI bêta**.

Nous prioriserons les équipes qui :

- Déploient déjà sur des environnements de prévisualisation éphémères par pull request.
- Disposent d'une équipe sécurité ou plateforme interne pouvant réviser l'intégration.
- Sont prêtes à fournir des retours hebdomadaires pendant la bêta.

## En attendant

- Utilisez le [Démarrage rapide](quickstart.md) pour lancer des scans manuellement après les gros déploiements.
- Utilisez le [lien partageable du rapport](reading-reports.md#partager-un-rapport) pour envoyer les résultats aux ingénieurs sans leur donner accès à l'espace de travail.
- Utilisez le [plafond de crédits par scan](quotas.md#plafond-de-crédits-par-scan) pour contrôler les coûts les semaines chargées.

---

Pages liées :

- [Démarrage rapide](quickstart.md)
- [Utilisation responsable](responsible-use.md)
- [Lire les rapports](reading-reports.md)
