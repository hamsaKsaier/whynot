---
title: "Calculateur de credits"
description: "Estimez votre consommation mensuelle de credits et trouvez le plan adapte avec des scenarios d'exemple et des conseils d'optimisation."
lang: fr
draft: false
---

# Calculateur de credits

## Comment utiliser le calculateur

Le calculateur de credits WhyNot vous permet d'estimer votre consommation mensuelle et de determiner le pack de credits le mieux adapte a votre equipe. Cet outil prend en compte le nombre de developpeurs, la frequence des operations et les types de tests utilises.

### Etape 1 -- Renseigner l'utilisation mensuelle

Indiquez le nombre de developpeurs actifs et, pour chaque type d'operation, la frequence estimee par developpeur et par mois :

| Operation | Credits/unite | Frequence a renseigner |
|---|---|---|
| Generation de tests | 50 | Nombre de tests generes par developpeur/mois |
| Execution de tests | 10 | Nombre d'executions par developpeur/mois |
| Boucle QA | 30 | Nombre de boucles QA par developpeur/mois |
| Correction automatique | 100 | Nombre de corrections par developpeur/mois |
| Regression visuelle | 15 | Nombre de comparaisons par developpeur/mois |
| Monitoring QA | 200 | Nombre de sessions de monitoring/mois (equipe) |
| Scan CI | 200 | Nombre de scans CI/mois (equipe) |

> **Remarque :** les operations de monitoring QA et de scan CI sont generalement definies au niveau de l'equipe (et non par developpeur), car elles sont declenchees par les pipelines CI/CD partages.

### Etape 2 -- Consulter l'estimation

Le calculateur affiche :

- **Consommation mensuelle estimee** (en credits)
- **Cout mensuel estime** (en USD, pour chaque pack)
- **Pack recommande** (en fonction de votre volume)
- **Economie potentielle** par rapport au pack Starter

---

## Scenarios d'exemple

### Scenario 1 -- Petite equipe (5 developpeurs)

Une equipe de 5 developpeurs travaillant sur un projet web avec des tests reguliers.

| Operation | Par developpeur/mois | Total equipe/mois | Credits/unite | Credits total |
|---|---|---|---|---|
| Generation de tests | 10 | 50 | 50 | 2 500 |
| Execution de tests | 40 | 200 | 10 | 2 000 |
| Boucle QA | 5 | 25 | 30 | 750 |
| Correction automatique | 2 | 10 | 100 | 1 000 |
| Regression visuelle | 8 | 40 | 15 | 600 |
| Monitoring QA | -- | 4 | 200 | 800 |
| Scan CI | -- | 20 | 200 | 4 000 |
| **Total** | | | | **11 650** |

**Estimation des couts mensuels :**

| Pack | Prix | Credits inclus | Packs necessaires | Cout mensuel |
|---|---|---|---|---|
| Starter (1 000) | $10 | 1 000 | 12 | $120 |
| Growth (10 000) | $80 | 10 000 | 2 | $160 |
| Scale (100 000) | $600 | 100 000 | 1 | $600 |

> **Recommandation :** le pack **Growth** (2 packs, soit 20 000 credits pour $160/mois) est le choix le plus adapte pour ce scenario. Vous disposez d'une marge confortable et beneficiez de la reduction de 20 % par rapport au tarif Starter.

---

### Scenario 2 -- Equipe moyenne (20 developpeurs)

Une equipe de 20 developpeurs avec une utilisation intensive des tests et du monitoring.

| Operation | Par developpeur/mois | Total equipe/mois | Credits/unite | Credits total |
|---|---|---|---|---|
| Generation de tests | 15 | 300 | 50 | 15 000 |
| Execution de tests | 80 | 1 600 | 10 | 16 000 |
| Boucle QA | 8 | 160 | 30 | 4 800 |
| Correction automatique | 5 | 100 | 100 | 10 000 |
| Regression visuelle | 12 | 240 | 15 | 3 600 |
| Monitoring QA | -- | 15 | 200 | 3 000 |
| Scan CI | -- | 60 | 200 | 12 000 |
| **Total** | | | | **64 400** |

**Estimation des couts mensuels :**

| Pack | Prix | Credits inclus | Packs necessaires | Cout mensuel |
|---|---|---|---|---|
| Starter (1 000) | $10 | 1 000 | 65 | $650 |
| Growth (10 000) | $80 | 10 000 | 7 | $560 |
| Scale (100 000) | $600 | 100 000 | 1 | $600 |

> **Recommandation :** le pack **Scale** (100 000 credits pour $600/mois) est le choix optimal. Vous beneficiez de la reduction maximale de 40 % par rapport au tarif Starter et disposez d'une reserve de 35 600 credits pour les pics d'activite.

---

### Scenario 3 -- Grande equipe (50+ developpeurs)

Une organisation de plus de 50 developpeurs avec des pipelines CI/CD intensifs et un monitoring continu.

| Operation | Par developpeur/mois | Total equipe/mois | Credits/unite | Credits total |
|---|---|---|---|---|
| Generation de tests | 20 | 1 000 | 50 | 50 000 |
| Execution de tests | 100 | 5 000 | 10 | 50 000 |
| Boucle QA | 10 | 500 | 30 | 15 000 |
| Correction automatique | 8 | 400 | 100 | 40 000 |
| Regression visuelle | 15 | 750 | 15 | 11 250 |
| Monitoring QA | -- | 30 | 200 | 6 000 |
| Scan CI | -- | 150 | 200 | 30 000 |
| **Total** | | | | **202 250** |

**Estimation des couts mensuels :**

| Pack | Prix | Credits inclus | Packs necessaires | Cout mensuel |
|---|---|---|---|---|
| Starter (1 000) | $10 | 1 000 | 203 | $2 030 |
| Growth (10 000) | $80 | 10 000 | 21 | $1 680 |
| Scale (100 000) | $600 | 100 000 | 3 | $1 800 |

> **Recommandation :** le pack **Growth** (21 packs, soit 210 000 credits pour $1 680/mois) offre le meilleur rapport qualite-prix pour ce volume. Neanmoins, pour des volumes aussi importants, nous vous recommandons de contacter notre equipe commerciale afin de negocier un tarif personnalise.

---

## Conseils pour optimiser votre consommation

### 1. Privilegiez les executions groupees

Regroupez vos executions de tests plutot que de les lancer individuellement. Cela vous permet de mieux suivre votre consommation et d'identifier les tests redondants.

### 2. Ajustez la frequence du monitoring QA

Le monitoring QA consomme 200 credits par session. Evaluez si une frequence quotidienne est necessaire ou si une frequence hebdomadaire suffit pour votre projet :

| Frequence | Sessions/mois | Credits/mois |
|---|---|---|
| Quotidienne | 30 | 6 000 |
| Tous les 2 jours | 15 | 3 000 |
| Hebdomadaire | 4 | 800 |

### 3. Utilisez les scans CI de maniere ciblee

Les scans CI (200 credits chacun) peuvent representer une part importante de votre consommation. Considerez les strategies suivantes :

- **Branches principales uniquement :** limitez les scans CI aux branches `main` et `develop` pour reduire le volume.
- **Declenchement conditionnel :** configurez vos pipelines pour declencher un scan CI uniquement lorsque des fichiers critiques sont modifies.
- **Horaires fixes :** planifiez les scans CI a des horaires reguliers (par exemple, une fois par jour) plutot qu'a chaque commit.

### 4. Exploitez la correction automatique avec discernement

La correction automatique (100 credits) est l'operation individuelle la plus couteuse apres le monitoring et les scans CI. Reservez-la aux echecs de tests recurrents ou complexes, et corrigez manuellement les cas simples.

### 5. Surveillez votre consommation regulierement

Consultez le tableau de bord de consommation au moins une fois par semaine. Identifiez les tendances et ajustez vos pratiques avant d'atteindre un seuil d'alerte.

### 6. Choisissez le bon pack des le depart

Utilisez les scenarios ci-dessus comme reference pour estimer votre consommation initiale. Il est plus economique d'acheter un pack Scale ($0,006/credit) que plusieurs packs Starter ($0,01/credit) -- l'economie atteint 40 %.

### 7. Exploitez la facturation annuelle

Si vous etes confiant dans votre usage a long terme, la facturation annuelle reduit de 20 % le cout du plan (soit $117,60 d'economies par an sur le plan Pro Managed). Combinez-la avec un pack Scale pour un avantage financier maximal.

---

## Recapitulatif

Le calculateur utilise la formule suivante :

```
Credits mensuels = SUM(
  operations_par_developpeur[i] x nombre_developpeurs x credits_par_operation[i]
) + SUM(
  operations_equipe[j] x credits_par_operation[j]
)
```

Ou `operations_par_developpeur[i]` represente la frequence mensuelle de chaque operation individuelle, `nombre_developpeurs` correspond au nombre de developpeurs actifs, `operations_equipe[j]` represente les operations partagees (monitoring QA, scans CI) et `credits_par_operation` correspond au cout en credits de chaque type d'operation.

Ressources complementaires :

- [Documentation des plans](plans.md) -- comparaison detaillee des plans Free, Pro BYO et Pro Managed
- [Credits pay-as-you-go](payg.md) -- fonctionnement des credits, packs et FAQ
