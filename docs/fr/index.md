---
title: "Documentation WhyNot QA"
description: "Bienvenue dans la documentation de WhyNot QA — une plateforme d'automatisation de tests propulsee par l'IA."
lang: fr
draft: false
---

# Documentation WhyNot QA

Bienvenue dans la documentation de WhyNot QA — une plateforme d'automatisation de tests propulsee par l'IA.

## Sections

### Tests
- [Tests IA](testing/) — Fonctionnement de la generation et de l'execution de tests par IA

### Paiements
- [Facturation et abonnements](payments/) — Gestion des forfaits, credits et factures

### Feature Flags
- [Gestion des feature flags](feature-flags/) — Controle de la disponibilite des fonctionnalites

### IA
- [Configuration des fournisseurs d'IA](ai/) — Configuration des cles API pour les fournisseurs d'IA

### Internationalisation (i18n)
- [Comment ajouter une cle de traduction](i18n/how-to-add-a-translation-key.md) — Guide pour ajouter des chaines traduisibles

## Langues supportees

WhyNot QA prend en charge les langues suivantes :

| Langue | Code | Direction |
|--------|------|-----------|
| Anglais | `en` | Gauche a droite |
| Arabe | `ar` | Droite a gauche |
| Francais | `fr` | Gauche a droite |
| Allemand | `de` | Gauche a droite |
| Espagnol | `es` | Gauche a droite |

## Support RTL

L'interface prend entierement en charge la direction de texte droite-a-gauche pour l'arabe. Lorsque l'arabe est selectionne :

- `dir="rtl"` est defini sur l'element HTML
- Les mises en page Flexbox s'inversent automatiquement
- Les proprietes logiques CSS sont utilisees (`ms-*`, `me-*`, `ps-*`, `pe-*`)
- Les icones directionnelles sont miroitees avec `rtl:scale-x-[-1]`
