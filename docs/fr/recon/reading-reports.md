---
title: "Recon — Lire les rapports"
description: "Structure du rapport, partage et export PDF des résultats de scan Recon."
lang: fr
draft: false
---

# Lire les rapports

Un rapport Recon est la sortie lisible par un humain d'un scan. Il est organisé pour être utile à trois audiences dans le même document : un ingénieur qui doit corriger le problème, un réviseur sécurité qui doit le valider et un dirigeant qui a besoin de connaître l'étendue des dégâts.

Cette page explique la structure du rapport, comment le partager et comment l'exporter en PDF.

---

## Où trouver les rapports

Chaque scan produit un rapport, disponible dès la fin du scan.

- Depuis la page d'accueil Recon, cliquez sur la ligne d'un scan pour ouvrir sa page de détails.
- Sur la page de détails du scan, l'onglet **Rapport** affiche le rapport complet inline.
- Chaque scan a aussi une URL stable — vous pouvez la partager (sous réserve des permissions ci-dessous).

## Structure du rapport

Un rapport comporte six sections, toujours dans cet ordre :

### 1. Résumé

Un paragraphe écrit pour un lecteur exécutif. Il indique la cible, la portée, le total des résultats par gravité et le point clé unique le plus important (« Un résultat critique a été confirmé. » ou « Aucun résultat exploitable. »).

### 2. Aperçu des risques

Un tableau du nombre de résultats par gravité, avec une comparaison au scan précédent de la même cible si disponible.

| Gravité | Ce scan | Scan précédent | Évolution |
|---------|---------|----------------|-----------|
| Critique | 1 | 0 | +1 |
| Élevée | 3 | 5 | -2 |
| Moyenne | 7 | 6 | +1 |
| Faible | 12 | 14 | -2 |
| Info | 22 | 19 | +3 |

La colonne évolution est le meilleur indicateur unique pour savoir si la remédiation fonctionne.

### 3. Résultats

Chaque résultat est rendu sous forme de fiche complète contenant :

- Titre et badge de gravité.
- Cible (endpoint, paramètre ou surface).
- Classe de vulnérabilité.
- **Ce qui s'est passé** — description en langage clair.
- **Preuve de concept** — l'artefact reproductible, avec coloration syntaxique.
- **Issue d'exploitation** — lecture confirmée, écriture confirmée, etc. Voir [Comprendre les résultats](understanding-findings.md).
- **Pourquoi c'est important** — l'impact réel.
- **Remédiation recommandée** — une correction spécifique et exploitable.
- **Références** — liens vers CWE, OWASP et avis fournisseurs lorsque pertinent.

Les résultats sont triés par gravité décroissante puis par confiance décroissante.

### 4. Périmètre et méthodologie

Liste ce qui a été scanné (URLs, endpoints découverts, paramètres testés), ce qui était explicitement hors périmètre, la référence d'autorisation et le niveau de portée du scan (surface, standard, approfondi).

### 5. Lacunes de couverture

Divulgation honnête de ce que le scan n'a pas atteint : endpoints nécessitant une authentification que Recon n'avait pas, endpoints bloqués par des règles WAF, zones où le budget de crawl s'est épuisé. Un scan qui ne révèle pas ses lacunes se survend.

### 6. Piste d'audit

L'enregistrement d'autorisation (qui, quand, quelle cible, quelle référence), les horodatages de début et de fin du scan et une entrée de provenance d'une ligne pour chaque phase.

## Partager un rapport

Trois moyens de partager un rapport :

### Membres de l'espace de travail

Toute personne dans l'espace de travail avec la permission `recon.scan.view` peut ouvrir directement le rapport. Aucune action supplémentaire requise.

### Lien partageable (externe)

Générez un lien en lecture seule à durée limitée pour un réviseur qui n'est pas membre de l'espace de travail.

1. Ouvrez la page de détails du scan.
2. Cliquez sur **Partager** dans l'en-tête.
3. Choisissez une expiration (24 heures, 7 jours ou 30 jours) et, optionnellement, un mot de passe.
4. Copiez le lien et envoyez-le.

Les visiteurs externes voient une vue assainie : le contenu du rapport, mais pas la navigation de l'espace de travail, ni les données de facturation, ni les autres scans. Ils ne peuvent ni déclencher un re-scan ni rien modifier.

### Export PDF

Cliquez sur **Exporter PDF** dans l'en-tête du rapport. Recon rend le rapport en PDF avec le même modèle que la vue web. Le PDF :

- Inclut chaque section ci-dessus.
- Intègre les preuves de concept comme blocs de code formatés.
- Est paginé avec un en-tête répété (nom du scan, cible, date).
- Convient pour être attaché à un ticket d'audit ou envoyé par e-mail à un dirigeant.

L'export PDF est généré à la demande et n'est pas mis en cache — un nouvel export après un re-scan reprend les données les plus récentes.

## Récapitulatif des permissions

| Action | Permission requise |
|--------|---------------------|
| Voir un rapport dans l'espace de travail | `recon.scan.view` |
| Créer un lien partageable | `recon.scan.share` |
| Exporter en PDF | `recon.scan.view` |
| Révoquer un lien partageable | `recon.scan.share` ou propriétaire |
| Supprimer un scan et son rapport | Propriétaire de l'espace de travail |

## Conservation

Les rapports sont conservés pendant toute la fenêtre de conservation des données de votre plan (voir [Quotas](quotas.md) — Free : 7 jours, Pro BYO : 30 jours, Pro Managed : 90 jours). Après expiration, le rapport est supprimé ; la ligne du journal d'audit d'autorisation est conservée pendant toute la durée de vie de l'espace de travail.

## Quand re-scanner

Re-scannez quand :

- Vous pensez avoir corrigé au moins un résultat. Le diff de la section 2 est la vérification.
- La cible a changé substantiellement (nouveaux endpoints, nouveau modèle d'authentification).
- Plus de 30 jours se sont écoulés depuis le dernier scan d'une cible critique.

Ne re-scannez pas uniquement pour faire bouger le rapport. Chaque scan coûte des crédits (voir [Quotas](quotas.md)) et chaque scan enregistre une nouvelle entrée d'autorisation.

---

Pages liées :

- [Comprendre les résultats](understanding-findings.md) — barème de gravité et issues d'exploitation.
- [Exemple de rapport](sample-report.md) — un exemple expurgé.
- [Quotas et facturation](quotas.md) — combien coûte un re-scan.
