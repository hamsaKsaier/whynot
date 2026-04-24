---
title: "Recon — Dépannage"
description: "Échecs courants lors de l'exécution de scans Recon et comment les résoudre."
lang: fr
draft: false
---

# Dépannage

Cette page couvre les modes de défaillance les plus courants lors du lancement ou de l'exécution d'un scan Recon, avec la cause et la solution. Si vous rencontrez un problème non listé ici, contactez le support en incluant l'ID du scan présent dans l'URL.

---

## Je ne vois pas Recon dans la barre latérale

**Cause.** Le drapeau `recon_enabled` est désactivé pour votre espace de travail.

**Solution.** Demandez à un propriétaire d'espace de travail d'activer Recon dans **Paramètres → Drapeaux de fonctionnalités**. Si vous êtes propriétaire et ne voyez pas le drapeau, votre plan n'inclut pas Recon — voir [Quotas](quotas.md).

## « Autorisation requise » — erreur 400 au lancement d'un scan

**Cause.** La requête de nouveau scan a atteint la passerelle sans bloc d'autorisation valide. Cela signifie généralement que l'une des trois cases de confirmation n'a pas été cochée, ou que le formulaire a été soumis avant que le champ entité juridique ne soit rempli.

**Solution.**

1. Ouvrez à nouveau l'assistant de nouveau scan.
2. À l'étape autorisation, cochez les trois cases :
   - « Je suis autorisé à scanner cette cible. »
   - « Je comprends que ce scan enverra des sondes actives. »
   - L'entité juridique que vous représentez.
3. Soumettez à nouveau.

Si l'erreur persiste, vérifiez la console du navigateur pour une charge utile manquant le champ `authorization` — cela peut arriver si une extension de navigateur réécrit les soumissions de formulaire.

## Avertissement « Dépôt non connecté » dans l'assistant

**Cause.** Vous avez choisi une cible dont l'environnement est associé à un dépôt git, mais ce dépôt n'est pas actuellement connecté à l'espace de travail.

**Solution.** Ceci est un avertissement, pas un blocage. Vous pouvez lancer le scan sans dépôt connecté — Recon sautera la phase d'analyse basée sur le code source. Pour activer l'analyse basée sur le code source :

1. Ouvrez **Paramètres → Intégrations**.
2. Connectez le dépôt (GitHub, GitLab, Bitbucket).
3. Relancez le scan.

Le coût en crédits inclus dans l'assistant est le même avec ou sans dépôt connecté ; le signal plus profond rend simplement les résultats plus précis.

## « URL d'environnement manquante » au lancement

**Cause.** L'environnement sélectionné n'a pas de `base_url` défini.

**Solution.** Ouvrez l'environnement dans **Paramètres → Environnements**, définissez une URL de base (doit être `https://` dans la plupart des espaces de travail), enregistrez, puis rouvrez l'assistant.

## Un scan reste « en cours » pendant des heures

**D'abord, vérifiez le plafond de crédits par scan.** Un scan qui atteint le plafond est arrêté proprement et passe à l'état `terminated` — il n'apparaît pas comme bloqué. Si le plafond est `0`, ce n'est pas la cause.

**Ensuite, vérifiez l'indicateur de phase** sur la page de détails du scan. Si la même phase est affichée pendant plus d'une heure sans progrès, le scan est réellement bloqué.

**Solution.**

1. Cliquez sur **Pause** sur la page de détails.
2. Attendez 30 secondes.
3. Cliquez sur **Reprendre**. Notez que la reprise exige que l'URL cible originale corresponde octet par octet à l'URL cible reprise — voir [Utilisation responsable](responsible-use.md#la-reprise-exige-une-url-identique).
4. Si le scan ne reprend pas avec succès, cliquez sur **Annuler** et lancez un nouveau scan. Vous ne serez pas facturé pour les phases incomplètes.

Si plusieurs scans se bloquent à la même phase contre la même cible, la cible peut limiter le débit de Recon. Réduisez la portée de Approfondi à Standard, ou contactez le support.

## La reprise a échoué avec « URL non concordante »

**Cause.** L'URL cible a changé entre la pause et la reprise. C'est une vérification de sécurité délibérée — voir [Utilisation responsable](responsible-use.md#la-reprise-exige-une-url-identique).

**Solution.** Lancez un nouveau scan avec un nouveau bloc d'autorisation. N'essayez pas de contourner la vérification d'URL ; elle existe pour une raison.

## La preuve de concept d'un résultat ne se reproduit pas manuellement

**Causes possibles.**

- L'état de la cible a changé entre le scan et votre rejeu manuel (un correctif a atterri, une session a expiré, un drapeau de fonctionnalité a basculé).
- La preuve de concept dépend d'un cookie de session ou d'un jeton d'authentification qui a depuis été tourné.
- Le scan a exploité une condition de course qui ne se reproduit pas de manière fiable.

**Solution.**

1. Re-scannez la cible. Si le résultat réapparaît, il est encore actif ; sinon il a probablement été corrigé.
2. Si le résultat réapparaît mais que vous ne pouvez toujours pas le reproduire manuellement, inspectez la section **Lacunes de couverture** du rapport — la sonde originale a peut-être utilisé des identifiants que vous n'avez pas.
3. Si vous suspectez un vrai faux positif, cliquez sur **Signaler un faux positif** sur la fiche du résultat. Le pipeline les utilise pour améliorer le score de confiance. Voir [Comprendre les résultats — politique des faux positifs](understanding-findings.md#politique-des-faux-positifs).

## « Budget de scan dépassé — plafond de l'espace de travail atteint »

**Cause.** Votre espace de travail a atteint son allocation mensuelle de scans ou de crédits Recon, et la facturation PAYG est désactivée (plan Free, ou votre contact de facturation a explicitement désactivé le dépassement).

**Solution.** Passez à un plan payant, activez PAYG ou attendez le prochain cycle de facturation. Voir [Quotas](quotas.md).

## Un résultat que je m'attendais à voir est manquant dans le rapport

**Causes possibles.**

- Le résultat n'avait pas de preuve de concept reproductible et a été supprimé sous la politique **pas d'exploit, pas de rapport**. Voir [Comprendre les résultats](understanding-findings.md#pas-dexploit-pas-de-rapport).
- Le résultat a été précédemment rejeté comme `false_positive`, `accepted_risk`, `duplicate` ou `out_of_scope` et est supprimé des scans suivants.
- L'endpoint hébergeant le problème est dans une lacune de couverture (auth requise, WAF bloquant, budget de crawl épuisé). Vérifiez la section **Lacunes de couverture**.

**Solution.** Ouvrez **Recon → Résultats → Tous (y compris rejetés)** pour voir les résultats supprimés et rejetés. Si un vrai problème est supprimé, annulez son rejet sur la fiche.

## L'avertissement « Environnement de production sélectionné » bloque mon flux

**Cet avertissement ne bloque pas.** C'est un interstitiel dans l'assistant. Vous pouvez toujours lancer le scan ; l'avertissement existe pour s'assurer que vous vouliez vraiment scanner la production.

Si vous trouvez l'avertissement gênant parce que vous scannez la production délibérément et fréquemment, nous sommes ouverts à ajouter un bouton « Je scanne toujours la production, supprimer cet avertissement » par espace de travail. Ouvrez une demande de fonctionnalité.

## Je dois supprimer un scan

Les propriétaires d'espace de travail peuvent supprimer un scan depuis la page de détails (**Plus → Supprimer le scan**). La suppression d'un scan retire :

- La ligne du scan.
- Les résultats.
- Le rapport.

La suppression d'un scan **ne retire pas** la ligne du journal d'audit d'autorisation — celles-ci sont immuables pour toute la durée de vie de l'espace de travail.

## Toujours bloqué ?

- Pour les problèmes au niveau de la plateforme (erreurs UI, problèmes de connexion) : [docs de dépannage](../../TROUBLESHOOTING.md) générales.
- Pour les problèmes spécifiques à Recon non couverts ici : contactez le support avec l'ID du scan dans l'URL.

---

Pages liées :

- [Démarrage rapide](quickstart.md)
- [Utilisation responsable](responsible-use.md)
- [Comprendre les résultats](understanding-findings.md)
- [Lire les rapports](reading-reports.md)
- [Quotas et facturation](quotas.md)
