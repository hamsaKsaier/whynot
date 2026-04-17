---
title: "Resolution des cles de plateforme"
description: "Gestion centralisee des cles API d'IA pour les operations de niveau gere dans WhyNot QA."
lang: fr
draft: false
---

# Resolution des cles de plateforme

La resolution des cles de plateforme fournit une gestion centralisee des cles API d'IA pour toutes les operations de niveau gere. Au lieu de stocker les cles dans des variables d'environnement, les administrateurs configurent et effectuent la rotation des cles via le tableau de bord d'administration.

## Flux de resolution

```
Requete utilisateur
  -> Verifier la config IA de l'utilisateur (getUserAIModel)
  -> Si pas de config utilisateur + niveau managed_payg
       -> Resolution de cle plateforme (getPlatformAIModel)
            -> Lire le fournisseur par defaut depuis billing_config
            -> Dechiffrer la cle depuis platform_ai_config
            -> Si le fournisseur par defaut n'a pas de cle active
                 -> Iterer ai_fallback_order
                 -> Retourner le premier fournisseur avec une cle active
            -> Si aucun fournisseur n'a de cles
                 -> Lancer errors:ai.noPlatformKey
```

## Fonctions principales

| Fonction | Objectif |
|----------|----------|
| `getPlatformAIModel()` | Retourne le modele IA par defaut de la plateforme avec chaine de repli |
| `getPlatformAIModelForProvider(provider, model?)` | Retourne un modele pour un fournisseur specifique |
| `getPlatformAPIKey(provider)` | Retourne la cle API dechiffree pour un fournisseur |
| `getAllPlatformConfigs()` | Retourne tous les fournisseurs actifs avec cles dechiffrees (usage interne uniquement) |

## Comportement du cache

Les cles dechiffrees sont mises en cache en memoire pendant **60 secondes** pour eviter de soliciter la base de donnees a chaque requete IA.

- Le cache est un singleton global (`platformKeyCache`)
- Les entrees expirent automatiquement apres 60s de TTL
- Les endpoints API d'administration appellent `platformKeyCache.invalidate(provider)` lors de la modification des cles
- `platformKeyCache.invalidateAll()` vide l'integralite du cache

**Delai de propagation :** Les modifications administratives des cles se propagent en moins de 60 secondes.

## Chaine de repli

La chaine de repli est configuree via deux entrees `billing_config` :

1. **`default_ai_provider`** — Objet JSON `{ provider, model }` specifiant le fournisseur principal
2. **`ai_fallback_order`** — Tableau JSON d'identifiants de fournisseurs par ordre de priorite

### Support de cle de secours

Chaque fournisseur peut avoir une **cle principale** et une **cle de secours** :

- La cle principale (`api_key_encrypted`) est essayee en premier
- Si la principale est nulle mais que la secours existe (`fallback_key_encrypted`), la secours est utilisee
- Cela gere la rotation des cles

## Securite

- Toutes les cles API sont **chiffrees au repos** avec AES-256-GCM
- Le dechiffrement se fait **uniquement en memoire** pour les appels API
- `getAllPlatformConfigs()` est restreint aux endpoints internes — jamais expose publiquement
- Les cles masquees (format `sk-*****XXXX`) sont utilisees dans toutes les reponses d'administration

## Integration du niveau gere

La fonction `getUserAIModel()` gere le repli base sur le niveau :

1. Si l'utilisateur a sa propre config IA, elle est utilisee (tous les niveaux)
2. Si pas de config utilisateur et espace de travail en `managed_payg`, repli vers `getPlatformAIModel()`
3. Si pas de config utilisateur et espace de travail en `byo_keys`, retourne null
