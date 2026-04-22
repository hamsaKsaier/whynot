---
title: "Credits pay-as-you-go"
description: "Achetez des credits supplementaires au-dela du quota de votre plan. Decouvrez le fonctionnement des credits, le cout des operations et les packs disponibles."
lang: fr
draft: false
---

# Credits pay-as-you-go

## Principe de fonctionnement

Le systeme de credits pay-as-you-go vous permet de payer uniquement pour les operations que vous consommez. Chaque operation sur la plateforme WhyNot consomme un nombre defini de credits. Vous achetez des packs de credits a l'avance, et ceux-ci sont debites au fur et a mesure de votre utilisation.

---

## Cout en credits par operation

Chaque type d'operation consomme un nombre fixe de credits :

| Operation | Credits par unite | Description |
|---|---|---|
| Generation de tests | 50 | Generation automatique d'un test a partir de votre code source |
| Execution de tests | 10 | Execution d'un test individuel sur l'infrastructure WhyNot |
| Boucle QA | 30 | Cycle complet d'analyse qualite (detection + rapport) |
| Correction automatique (auto-fix) | 100 | Application automatique d'un correctif sur un test echoue |
| Regression visuelle | 15 | Comparaison visuelle pixel par pixel entre deux captures |
| Monitoring QA | 200 | Session de surveillance continue de la qualite (par execution) |
| Scan CI | 200 | Analyse automatisee declenchee par votre pipeline CI/CD |

### Exemples de consommation

- **Generer 10 tests puis les executer :** (10 x 50) + (10 x 10) = 600 credits
- **Boucle QA complete avec correction :** 30 + 100 = 130 credits
- **Regression visuelle sur 20 pages :** 20 x 15 = 300 credits
- **Scan CI quotidien (30 jours) :** 30 x 200 = 6 000 credits

---

## Packs de credits

Trois packs de credits sont disponibles, avec des reductions progressives pour les volumes superieurs :

| Pack | Credits | Prix | Prix par credit | Economie |
|---|---|---|---|---|
| **Starter** | 1 000 | $10 | $0,0100 | -- |
| **Growth** | 10 000 | $80 | $0,0080 | 20 % |
| **Scale** | 100 000 | $600 | $0,0060 | 40 % |

### Quel pack choisir ?

| Profil | Pack recommande | Justification |
|---|---|---|
| Developpeur individuel | Starter (1 000 credits) | Utilisation occasionnelle, decouverte |
| Petite equipe (2-5 personnes) | Growth (10 000 credits) | Utilisation reguliere, bon rapport qualite-prix |
| Equipe moyenne a grande (5+ personnes) | Scale (100 000 credits) | Utilisation intensive, meilleur prix unitaire |

---

## Comment les credits fonctionnent

### Achat de credits

Vous pouvez acheter des packs de credits a tout moment depuis la section **Parametres > Facturation > Credits** de votre tableau de bord. Le paiement est immediat et les credits sont disponibles instantanement. Les credits achetes via differents packs se cumulent dans votre solde : par exemple, un pack Starter plus un pack Growth donnent un solde total de 11 000 credits.

### Consommation et solde insuffisant

Chaque operation declenchee sur la plateforme debite automatiquement le nombre de credits correspondant de votre solde. Si votre solde est insuffisant, l'operation est bloquee et vous recevez une notification pour recharger. Aucune operation n'est executee a credit negatif — aucune mauvaise surprise de facturation.

### Suivi, alertes et notifications

Un historique detaille de toutes les operations et de leur cout en credits est disponible dans **Parametres > Facturation > Historique d'utilisation**, avec filtres par type d'operation, projet et periode. WhyNot envoie egalement des notifications automatiques lorsque le solde atteint certains seuils :

| Seuil | Notification |
|---|---|
| 20 % du solde restant | Alerte par email : solde bas |
| 10 % du solde restant | Alerte par email + notification in-app |
| 0 credit | Operations bloquees, notification urgente |

Vous pouvez personnaliser ces seuils dans les parametres de notification de votre compte.

---

## Foire aux questions

### Les credits expirent-ils ?

Oui. Les credits non utilises expirent **12 mois** apres la date d'achat. Passe ce delai, les credits restants sont perdus et ne peuvent etre ni rembourses ni transferes.

> **Conseil :** achetez des credits en fonction de votre consommation prevue pour eviter toute perte. Consultez le [calculateur de credits](calculator.md) pour estimer vos besoins.

### Que se passe-t-il en cas de depassement (overage) ?

Il n'y a pas de depassement automatique. Si votre solde de credits tombe a zero, les operations sont suspendues jusqu'a ce que vous achetiez un nouveau pack de credits. Cela vous garantit un controle total sur vos depenses.

### Puis-je obtenir un remboursement pour des credits non utilises ?

Non. Les achats de credits sont definitifs et non remboursables. Nous vous recommandons de commencer par le pack Starter si vous n'etes pas certain de votre volume de consommation.

### Les credits sont-ils partages entre les projets ?

Oui. Votre solde de credits est global et partage entre tous les projets de votre compte. Chaque operation, quel que soit le projet, debite le meme solde.

### Les credits sont-ils inclus dans les plans Pro ?

Non. Les plans Pro (BYO et Managed) couvrent l'acces a la plateforme et aux fonctionnalites. Les credits pour les operations pay-as-you-go sont factures separement.

### Puis-je acheter plusieurs packs en meme temps ?

Oui. Vous pouvez acheter autant de packs que necessaire. Les credits de chaque pack sont ajoutes a votre solde et expirent individuellement 12 mois apres leur date d'achat respective.

### Comment puis-je suivre la consommation de mon equipe ?

Le tableau de bord fournit une vue detaillee de la consommation par utilisateur, par projet et par type d'operation. Les administrateurs de compte ont acces a l'ensemble des rapports de consommation.

---

## Recapitulatif des couts

| Operation | Credits | Cout (Starter) | Cout (Growth) | Cout (Scale) |
|---|---|---|---|---|
| Generation de tests | 50 | $0,50 | $0,40 | $0,30 |
| Execution de tests | 10 | $0,10 | $0,08 | $0,06 |
| Boucle QA | 30 | $0,30 | $0,24 | $0,18 |
| Correction automatique | 100 | $1,00 | $0,80 | $0,60 |
| Regression visuelle | 15 | $0,15 | $0,12 | $0,09 |
| Monitoring QA | 200 | $2,00 | $1,60 | $1,20 |
| Scan CI | 200 | $2,00 | $1,60 | $1,20 |
