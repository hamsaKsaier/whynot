---
title: "Gestion des secrets"
description: "Comment WhyNot gere les valeurs de configuration sensibles selon les environnements."
lang: fr
draft: true
---

# Gestion des secrets

Ce document decrit comment WhyNot gere les valeurs de configuration sensibles selon les environnements.

## Principes

1. **Ne jamais commiter les secrets** — `.env` est dans le gitignore. Seul `.env.example` (avec des valeurs d'exemple) est suivi.
2. **Ne jamais journaliser les secrets** — Le module de configuration de la passerelle valide les secrets au demarrage mais n'ecrit jamais leurs valeurs dans les logs.
3. **Echouer immediatement** — Les secrets requis manquants provoquent un echec immediat au demarrage avec un message d'erreur clair.

## Developpement

En developpement local, les secrets se trouvent dans votre fichier `.env` :

```bash
cp .env.example .env
# Fill in required values:
#   JWT_SECRET          — any long random string
#   SECRETS_ENCRYPTION_KEY — openssl rand -base64 32
#   ENCRYPTION_KEY      — any random string
```

En developpement local, vous pouvez utiliser des valeurs fictives. Les fonctionnalites OAuth et Stripe ne seront pas disponibles sans identifiants reels.

## Production

En production, les secrets doivent provenir de l'environnement hote ou d'un gestionnaire de secrets — **jamais** d'un fichier `.env` sur le disque.

### Approches recommandees

#### 1. Variables d'environnement de l'hote (le plus simple)

Definissez les variables directement sur l'hote ou dans votre plateforme de deploiement :

```bash
# Example: systemd service
Environment="JWT_SECRET=<real-value>"
Environment="SECRETS_ENCRYPTION_KEY=<real-value>"

# Example: Docker run
docker run -e JWT_SECRET=<real-value> -e SECRETS_ENCRYPTION_KEY=<real-value> ...
```

#### 2. Docker Secrets (Swarm)

Pour les deploiements Docker Swarm, utilisez Docker secrets :

```bash
echo "<real-jwt-secret>" | docker secret create jwt_secret -
```

#### 3. Gestionnaires de secrets cloud

- **AWS** : Secrets Manager ou SSM Parameter Store
- **GCP** : Secret Manager
- **Azure** : Key Vault

Injectez au demarrage du conteneur via l'injection native de secrets de votre orchestrateur.

## Rotation des secrets

### JWT_SECRET

La rotation de `JWT_SECRET` invalide toutes les sessions utilisateur existantes. Pour effectuer une rotation en douceur :

1. Ajoutez le nouveau secret en parallele de l'ancien (si votre middleware d'authentification prend en charge plusieurs cles)
2. Deployez avec le nouveau secret
3. Attendez l'expiration des anciens tokens (par defaut : 7 jours)
4. Supprimez l'ancien secret

### SECRETS_ENCRYPTION_KEY / ENCRYPTION_KEY

Ces cles chiffrent les identifiants stockes et les tokens d'integration. La rotation necessite de re-chiffrer toutes les valeurs stockees :

1. Generez une nouvelle cle : `openssl rand -base64 32`
2. Executez la migration de re-chiffrement (si disponible)
3. Deployez avec la nouvelle cle

### Cles Stripe

Les cles Stripe peuvent etre renouvelees dans le tableau de bord Stripe. Mettez a jour les variables d'environnement et redeployez.

## Secrets requis par environnement

| Secret | Developpement | Staging | Production |
|--------|---------------|---------|------------|
| `JWT_SECRET` | Valeur fictive OK | Valeur reelle | Valeur reelle (forte) |
| `SECRETS_ENCRYPTION_KEY` | Peut etre omis (fonctionnalite degradee) | Valeur reelle | Valeur reelle |
| `ENCRYPTION_KEY` | Peut etre omis (fonctionnalite degradee) | Valeur reelle | Valeur reelle |
| `GITHUB_CLIENT_ID/SECRET` | Optionnel | Valeur reelle | Valeur reelle |
| `GOOGLE_CLIENT_ID/SECRET` | Optionnel | Valeur reelle | Valeur reelle |
| `STRIPE_SECRET_KEY` | Optionnel | Cle mode test | Cle mode production |
| `STRIPE_WEBHOOK_SECRET` | Optionnel | Valeur reelle | Valeur reelle |
| `RESEND_API_KEY` | Optionnel | Valeur reelle | Valeur reelle |
| `ANTHROPIC_API_KEY` | Requis pour l'IA | Valeur reelle | Valeur reelle |

## Generation des secrets

```bash
# JWT secret (64 bytes, base64-encoded)
openssl rand -base64 64

# Encryption key (32 bytes, base64-encoded — required format for AES-256)
openssl rand -base64 32

# Generic random string
openssl rand -hex 32
```
