---
title: "Recon — Comprendre les résultats"
description: "Barème de gravité, sémantique des issues d'exploitation et politique des faux positifs des résultats Recon."
lang: fr
draft: false
---

# Comprendre les résultats

Un scan Recon produit zéro ou plusieurs **résultats**. Chaque résultat représente un problème de sécurité confirmé ou suspecté sur la cible, noté pour sa gravité et accompagné d'une preuve de concept reproductible.

Cette page explique comment lire un résultat : ce que signifient les étiquettes de gravité, ce que vous indique le champ issue d'exploitation et comment Recon décide de ce qu'il inclut dans un rapport.

---

## Anatomie d'un résultat

Chaque résultat possède les champs suivants :

| Champ | Signification |
|-------|---------------|
| **Titre** | Bref résumé du problème. |
| **Gravité** | Critique, Élevée, Moyenne, Faible ou Info. Voir le barème ci-dessous. |
| **Classe de vulnérabilité** | La catégorie — injection SQL, XSS reflété, SSRF, contrôle d'accès défaillant, etc. |
| **Cible** | L'endpoint ou la surface où le problème a été trouvé. |
| **Preuve de concept** | Un artefact reproductible (requête, commande ou script) démontrant le problème. |
| **Issue d'exploitation** | Ce que la preuve de concept a réellement obtenu. Voir ci-dessous. |
| **Remédiation recommandée** | Une correction concrète, pas une ligne générique sur les « bonnes pratiques ». |
| **Confiance** | Élevée, Moyenne ou Faible — le degré de certitude de Recon. |
| **Première / Dernière vue** | Horodatages à travers les scans. Une nouvelle exécution les met à jour. |

## Barème de gravité

Recon utilise un barème à cinq niveaux. La gravité est calculée à partir de trois entrées : l'impact technique, la facilité d'exploitation et le volume de données sensibles ou d'actions privilégiées exposées.

### Critique

Le problème permet à un attaquant distant non authentifié d'obtenir l'un des résultats suivants :

- Exécuter du code arbitraire sur la cible.
- Lire ou modifier des données de production arbitraires.
- Usurper l'identité d'un autre utilisateur sans sa coopération.
- Contourner un contrôle de sécurité essentiel (authentification, facturation, multi-locataire) en une seule requête.

Les résultats critiques doivent être traités comme des incidents. Supposez l'exploitation imminente.

### Élevée

Le problème permet une élévation de privilèges, un accès non autorisé aux données ou le contournement d'un contrôle de sécurité, mais nécessite au moins l'un des éléments suivants :

- Un compte valide à privilèges réduits.
- Une interaction utilisateur (p. ex. clic sur un lien préparé).
- Plusieurs requêtes chaînées.

Les résultats élevés doivent être corrigés en quelques jours, pas en semaines.

### Moyenne

Le problème expose des informations sensibles, affaiblit un contrôle de sécurité ou permet une attaque qui requiert un effort supplémentaire significatif (p. ex. un exploit chaîné ou un jeton de session volé). Les résultats moyens doivent être corrigés au prochain cycle de release.

### Faible

Le problème est un défaut de durcissement ou une couche de défense en profondeur affaiblie. L'exploiter isolément ne donne pas grand-chose. Exemples : en-têtes de sécurité manquants, messages d'erreur verbeux, bannières de serveur obsolètes.

### Info

Le problème n'est pas une vulnérabilité mais un élément de contexte sur la surface d'attaque que vous devez connaître : un panneau d'administration exposé, un domaine de staging indexé par les moteurs de recherche, un sous-domaine qui ne devrait pas être public.

## Issues d'exploitation

Chaque résultat dans un rapport est étayé par une tentative d'exploitation concrète. Le champ **issue d'exploitation** vous indique ce qu'a réellement fait cette tentative :

| Issue | Signification |
|-------|---------------|
| **Lecture confirmée** | Une preuve de concept non destructive a réussi : des données ont été lues, un marqueur retourné, ou une erreur a fait fuiter des informations. Sans danger à rejouer. |
| **Écriture confirmée** | Une charge utile destructive a réussi : l'état a été modifié, un enregistrement créé, mis à jour ou supprimé. Recon exécute les exploits de classe écriture exactement une fois par scan et ne les réessaie jamais (voir [Utilisation responsable](responsible-use.md)). |
| **Écriture tentée, issue inconnue** | Une charge utile destructive a été envoyée mais la réponse n'indique pas clairement le succès ou l'échec. Traitez-la comme une vulnérabilité suspectée et vérifiez manuellement. |
| **Lecture tentée, non concluante** | Une sonde non destructive s'est exécutée mais les preuves sont ambiguës. Généralement rétrogradée en Info ou supprimée. |

## Pas d'exploit, pas de rapport

Recon suit une stricte politique **« pas d'exploit, pas de rapport »**. Un résultat n'apparaît dans le rapport **que** s'il a un `proof_of_concept` non nul et exactement reproductible. Si une sonde n'a pas pu produire d'artefact fonctionnel, le résultat est soit supprimé, soit publié en Info sans entrée de rapport.

C'est délibéré. Un rapport rempli d'entrées « injection SQL suspectée » que vous ne pouvez pas reproduire est pire que pas de rapport, car il gaspille du temps de tri et érode la confiance. Quand Recon livre un résultat, vous pouvez le reproduire.

## Politique des faux positifs

Un faux positif est un résultat qui a semblé réel au pipeline automatisé mais qui n'est pas réellement exploitable. Le pipeline de Recon dispose de trois protections :

1. **Confirmation active.** Chaque résultat signalé inclut une preuve de concept réellement exécutée et observée comme produisant l'issue annoncée.
2. **Étiquetage de confiance.** Les résultats où la confirmation a réussi mais le contexte est ambigu sont étiquetés `medium` ou `low` confiance et accompagnés d'un avertissement.
3. **Rejet par l'utilisateur.** Vous pouvez rejeter tout résultat avec une raison : `false_positive`, `accepted_risk`, `duplicate` ou `out_of_scope`. Les résultats rejetés ne comptent pas dans les agrégats de gravité et sont supprimés du diff du scan suivant sauf si les preuves sous-jacentes changent.

Si vous trouvez un faux positif que le pipeline aurait dû attraper, utilisez le lien **Signaler un faux positif** sur la fiche du résultat. Nous utilisons ces signalements pour améliorer le score de confiance.

## Re-scans et diffs

Lorsque vous re-scannez la même cible :

- Les résultats encore présents mettent à jour leur horodatage `last_seen`.
- Les résultats présents auparavant et désormais absents sont marqués **corrigés**.
- Les résultats nouveaux apparaissent avec un badge `new`.

C'est ainsi que vous vérifiez qu'une remédiation a effectivement atterri. Un rapport où un résultat précédemment Critique est maintenant marqué **corrigé** est la sortie la plus utile que Recon puisse produire.

---

Pages liées :

- [Lire les rapports](reading-reports.md) — structure du rapport, partage, export PDF.
- [Exemple de rapport](sample-report.md) — un exemple expurgé.
- [Utilisation responsable](responsible-use.md) — pourquoi les exploits de classe écriture ne sont jamais réessayés.
