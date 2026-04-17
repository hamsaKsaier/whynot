---
title: "Configuration IA utilisateur"
description: "Guide des parametres de fournisseur d'IA du point de vue de l'utilisateur dans WhyNot QA."
lang: fr
draft: false
---

# Configuration IA utilisateur

Ce guide explique le fonctionnement des paramètres de fournisseur d'IA du point de vue de l'utilisateur, y compris les niveaux d'abonnement, la gestion des clés et le repli sur les clés de la plateforme.

## Niveaux d'abonnement

WhyNot QA propose deux niveaux d'abonnement qui déterminent l'accès aux fournisseurs d'IA :

### Apportez vos propres clés (`byo_keys`)

Plans : **Gratuit**, **Pro (BYO)**

- Les utilisateurs **doivent** fournir leurs propres clés API pour utiliser les fonctionnalités d'IA
- Pas d'accès aux clés gérées par la plateforme
- Les utilisateurs configurent les fournisseurs dans **Paramètres → IA**
- Les clés sont chiffrées au repos avec AES-256-GCM

### Géré + Paiement à l'usage (`managed_payg`)

Plans : **Pro (Géré + PAYG)**

- La plateforme fournit des clés IA préconfigurées — aucune configuration requise
- Les utilisateurs sont facturés à l'usage
- Les utilisateurs **peuvent optionnellement** ajouter leurs propres clés pour un accès personnalisé
- Lorsqu'un utilisateur a sa propre clé configurée, elle prend la priorité sur les clés de la plateforme

## Fonctionnement de la sélection du fournisseur

1. Le système vérifie d'abord si l'utilisateur a une clé API personnelle configurée
2. Si une clé personnelle existe et est définie par défaut, elle est utilisée
3. Si aucune clé personnelle n'existe et que l'utilisateur est sur un plan `managed_payg`, le fournisseur par défaut de la plateforme est utilisé
4. Si aucune clé personnelle n'existe et que l'utilisateur est sur un plan `byo_keys`, les fonctionnalités d'IA ne sont pas disponibles

## Fournisseurs configurés par l'administrateur

La liste des fournisseurs disponibles est contrôlée par l'administrateur dans **Admin → Fournisseurs d'IA**. Seuls les fournisseurs activés par l'administrateur apparaissent dans la liste déroulante de l'utilisateur.

L'option `Personnalisé (compatible OpenAI)` est toujours disponible.

## Onglet Paramètres (`Paramètres → IA`)

### Pour les utilisateurs `byo_keys`

- Une bannière explique que les clés API sont requises
- Si aucune clé n'est configurée, une invite encourage à en ajouter une

### Pour les utilisateurs `managed_payg`

- Une bannière indique que l'accès IA géré est inclus dans le plan
- Si aucune clé personnelle n'est configurée, un message affiche le fournisseur par défaut actuel de la plateforme

### Ajout d'une clé de fournisseur

1. Cliquez sur **Ajouter un fournisseur**
2. Sélectionnez un fournisseur dans la liste
3. Sélectionnez un modèle
4. Pour le fournisseur « Personnalisé », entrez l'URL de base
5. Entrez la clé API
6. Cliquez sur **Enregistrer**

### Gestion des cles

- **Tester la connexion** : Verifie que la cle API fonctionne en effectuant une requete de test
- **Definir par defaut** : Definit ce fournisseur comme fournisseur par defaut pour les operations IA
- **Supprimer** : Supprime la configuration du fournisseur

## Repli sur les cles de la plateforme

Pour les utilisateurs `managed_payg`, la plateforme maintient une chaine de repli de fournisseurs d'IA configuree par l'administrateur. Si le fournisseur principal echoue, le systeme essaie automatiquement le fournisseur suivant dans l'ordre de repli.

L'ordre de repli et le fournisseur par defaut sont configures dans **Admin → Fournisseurs d'IA → Parametres de facturation par defaut**.
