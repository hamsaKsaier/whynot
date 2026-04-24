---
title: "Recon — Quotas et facturation"
description: "Inclusions par plan, tarifs PAYG, facturation des scans partiels et plafonds de crédits par scan pour Recon."
lang: fr
draft: false
---

# Quotas et facturation

Les scans Recon consomment des **crédits** sur l'allocation mensuelle de votre espace de travail. Lorsque vous dépassez l'allocation, les crédits supplémentaires sont facturés au tarif paiement à l'usage (PAYG). Cette page explique ce qui est inclus, ce qui coûte plus cher et comment fonctionne la facturation des scans partiels.

Pour la tarification des plans sous-jacents (Free, Pro BYO, Pro Managed), voir la [page de tarification](/pricing) en direct.

---

## Ce qui est inclus par plan

| Plan | Scans Recon inclus | Scan de surface | Scan standard | Scan approfondi |
|------|---------------------|-----------------|---------------|-----------------|
| **Free** | 1/mois, surface uniquement | ✓ | — | — |
| **Pro BYO** | 5/mois, toute portée | ✓ | ✓ | ✓ |
| **Pro Managed** | Illimité (usage équitable), toute portée | ✓ | ✓ | ✓ |

Les scans inclus sont décomptés des crédits inclus de votre allocation mensuelle. Une fois épuisés, les scans supplémentaires sont facturés aux tarifs PAYG.

## Coût en crédits par scan

Le coût exact en crédits dépend de la complexité de la cible (nombre d'endpoints, paramètres, taille de réponse), mais les fourchettes typiques sont :

| Portée | Crédits typiques | Notes |
|--------|------------------|-------|
| Surface | 50–200 | Reconnaissance passive, sans sondage actif. |
| Standard | 500–2 000 | Surface + sondes actives pour les classes de vulnérabilités courantes. |
| Approfondi | 2 000–10 000 | Standard + sondage authentifié + crawl étendu. |

L'assistant affiche le **coût estimé** pour la portée choisie avant le lancement. Le coût final est calculé après la fin du scan et affiché sur la page de détails.

## Tarifs PAYG

Lorsque vous dépassez vos crédits inclus, les crédits supplémentaires sont facturés au tarif PAYG standard. Voir la [documentation PAYG](../pricing/payg.md) pour le prix par crédit en vigueur et les éventuelles remises sur volume.

## Facturation des scans partiels

Parfois un scan se termine avant d'avoir achevé toutes ses phases — vous l'annulez, le plafond de crédits par scan est atteint ou une panne transitoire l'arrête. Dans ces cas :

- Vous êtes facturé pour les **phases terminées uniquement**.
- Une phase démarrée mais non terminée n'est **pas** facturée.
- La page de détails affiche la décomposition exacte du coût phase par phase.

Si un scan échoue entièrement sans produire de données utiles, le coût est automatiquement remboursé à votre espace de travail sous 24 heures. Vous n'avez pas besoin d'ouvrir un ticket de support pour les échecs de routine.

## Plafond de crédits par scan

Pour éviter les factures surprise sur une cible mal configurée, définissez un **plafond de crédits par scan** dans **Paramètres → Recon**.

| Valeur du plafond | Effet |
|-------------------|-------|
| `0` | Pas de plafond au niveau de l'espace de travail. La valeur par défaut de la plateforme s'applique. |
| `1` à `100000` | Plafond strict pour un seul scan. Recon arrête le scan avant la prochaine phase payante qui dépasserait le plafond. |

Le plafond est appliqué avant le démarrage de chaque phase, vous pouvez donc payer légèrement moins que le plafond (selon le coût de la dernière phase achevée) mais jamais plus.

Valeurs de départ recommandées :

- **Free / évaluation** — laissez à `0` (pas de plafond ; faites confiance à l'allocation incluse).
- **Pro BYO** — réglez à `5000` si vous scannez des cibles de production régulièrement.
- **Pro Managed** — réglez à `15000` si vous lancez fréquemment des scans approfondis.

Ajustez selon votre historique de scans réel ; la page de détails affiche le coût de chaque scan précédent.

## Visibilité des quotas

L'utilisation Recon est affichée à deux endroits :

- **Paramètres → Facturation → Utilisation**, aux côtés des autres usages produit (exécutions de tests, générations IA, etc.).
- **Recon → Paramètres → Recon → Utilisation**, avec une décomposition Recon-only incluant les charges PAYG.

Les deux vues sont en temps réel. Pas de surprise en fin de mois.

## Garanties strictes

- **Pas de frais surprise.** Un scan qui dépasserait votre plafond par scan est arrêté, pas facturé au-delà du plafond.
- **Pas de changement de prix rétroactif.** Si nous changeons les tarifs PAYG, le nouveau tarif s'applique aux scans lancés après le changement. Les scans en cours sont facturés au tarif du moment du lancement.
- **Pas de dépassement sans avertissement.** Lorsque vous franchissez 80 % de votre allocation mensuelle, le contact de facturation est notifié par e-mail.

## Questions fréquentes

**Un scan échoué coûte-t-il des crédits ?**
Vous êtes facturé pour les phases terminées uniquement. Une phase non terminée n'est pas facturée. Un scan qui échoue avant qu'aucune phase ne se termine est entièrement remboursé sous 24 heures.

**Un re-scan de la même cible coûte-t-il moins ?**
Non. Chaque scan est indépendant. Nous n'offrons pas actuellement de mise en cache entre scans.

**Puis-je partager les scans inclus entre espaces de travail ?**
Non. Les scans inclus appartiennent à l'espace de travail auquel ils sont émis.

**Qu'est-ce qui compte comme « scan » pour la limite mensuelle du plan Free ?**
Tout scan lancé avec succès, même si vous l'annulez avant la fin. Un scan rejeté par la passerelle (p. ex. autorisation manquante, drapeau désactivé) ne compte pas.

---

Pages liées :

- [Tarification — plans](../pricing/plans.md) — inclusions globales par plan.
- [Tarification — paiement à l'usage](../pricing/payg.md) — tarifs PAYG et remises sur volume.
- [Démarrage rapide](quickstart.md) — comment lancer votre premier scan.
