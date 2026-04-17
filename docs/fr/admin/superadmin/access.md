---
title: "Acces Superadmin"
description: "Configuration et fonctionnement de l'espace superadmin de WhyNot QA."
lang: fr
draft: false
---

# Acces Superadmin

## Apercu

L'espace superadmin est accessible a `https://superadmin.whynot.skrum.io`. Il sert la meme application admin-frontend mais avec une navigation restreinte et un comportement adapte au nom d'hôte.

## Qui a acces

Seuls les utilisateurs avec le role `super_admin` peuvent acceder au nom d'hôte superadmin. Cela est applique a deux niveaux :

1. **Authentification** : Le flux de connexion exige le role `super_admin`. Les utilisateurs non-superadmin recoivent une erreur "acces refuse".
2. **Verification du nom d'hôte** : Si un utilisateur atteint `superadmin.whynot.skrum.io` sans le role `super_admin`, il voit une page "Acces refuse" claire avec une redirection vers `admin.whynot.skrum.io`.

## Differences avec admin.whynot.skrum.io

| Comportement | admin.whynot.skrum.io | superadmin.whynot.skrum.io |
|--------------|----------------------|---------------------------|
| Sections du menu lateral | Toutes les sections | Plateforme, Facturation, Flags & IA, Parametres uniquement |
| Redirection apres connexion | `/` (Tableau de bord) | `/users` |
| Titre du menu lateral | "Admin" | "Super Admin" |
| Flux d'acces refuse | Page interdite generique | Page dediee avec redirection vers admin |

## Fonctionnement

L'admin-frontend detecte le nom d'hôte via `window.location.hostname` en utilisant le helper dans `src/lib/hostname.ts`. Selon le mode detecte (`"admin"` ou `"superadmin"`) :

- **AdminShell** filtre les sections de navigation du menu lateral.
- **LoginPage** redirige vers `/users` au lieu de `/` apres une connexion reussie.
- **ProtectedRoute** affiche `AccessDeniedPage` au lieu de `ForbiddenPage` pour les utilisateurs non-superadmin sur le nom d'hôte superadmin.

## Noms d'hôtes supportes

| Nom d'hôte | Mode |
|------------|------|
| `superadmin.whynot.skrum.io` | `superadmin` |
| `superadmin.localhost` | `superadmin` (dev) |
| Tout autre | `admin` |

## Ajout du nom d'hôte superadmin

Aucun deploiement SPA separe n'est necessaire. Le nom d'hôte superadmin est un alias Nginx pointant vers le meme upstream `admin-frontend` (port 5184). Voir [Configuration Nginx](../../deployment/nginx-setup.md) pour les details.

### DNS

Creez un enregistrement A/AAAA pour `superadmin.whynot.skrum.io` pointant vers la meme IP que `whynot.skrum.io`.

### CORS

Le gateway doit inclure `https://superadmin.whynot.skrum.io` dans sa liste blanche CORS. Definissez `SUPERADMIN_FRONTEND_URL=https://superadmin.whynot.skrum.io` dans le fichier `.env`.
