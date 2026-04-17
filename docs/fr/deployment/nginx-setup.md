---
title: "Configuration Nginx"
description: "Configuration Nginx pour servir les trois noms d'hotes de WhyNot QA."
lang: fr
draft: false
---

# Configuration Nginx

WhyNot utilise un seul fichier de configuration Nginx pour servir trois noms d'hôtes :

| Nom d'hôte | Service amont | Port |
|------------|---------------|------|
| `whynot.skrum.io` | Frontend SPA | 5183 |
| `admin.whynot.skrum.io` | Admin Frontend SPA | 5184 |
| `superadmin.whynot.skrum.io` | Admin Frontend SPA (espace superadmin) | 5184 |

`superadmin.whynot.skrum.io` est un alias de nom d'hôte qui redirige vers le même service admin-frontend. L'application SPA detecte le nom d'hôte et restreint l'interface aux sections superadmin uniquement.

## Prerequis

- DNS : Les enregistrements A/AAAA pour les trois noms d'hôtes doivent pointer vers le serveur.
- Nginx installe sur le serveur hôte.
- Certbot installe pour le provisionnement des certificats TLS.

## Installation

Le fichier de configuration se trouve dans le depot a `docker/nginx/whynot.skrum.io`. Utilisez un lien symbolique pour propager automatiquement les modifications :

```bash
# Supprimer l'ancienne configuration non versionnee si elle existe
sudo rm -f /etc/nginx/sites-available/whynot
sudo rm -f /etc/nginx/sites-enabled/whynot

# Lien symbolique depuis le depot
sudo ln -sf /home/serverlessbase/whynot/docker/nginx/whynot.skrum.io \
            /etc/nginx/sites-available/whynot.skrum.io
sudo ln -sf /etc/nginx/sites-available/whynot.skrum.io \
            /etc/nginx/sites-enabled/whynot.skrum.io

# Tester et recharger
sudo nginx -t && sudo systemctl reload nginx
```

## TLS avec Certbot

Executez Certbot avec les trois noms d'hôtes :

```bash
sudo certbot --nginx \
  -d whynot.skrum.io \
  -d admin.whynot.skrum.io \
  -d superadmin.whynot.skrum.io
```

Certbot ajoute automatiquement les blocs `listen 443 ssl` et les directives `ssl_*`. Le renouvellement couvre les trois noms d'hôtes.

## Synchronisation manuelle (alternative)

Si vous preferez copier plutôt que de creer un lien symbolique :

```bash
sudo cp /home/serverlessbase/whynot/docker/nginx/whynot.skrum.io \
        /etc/nginx/sites-available/whynot.skrum.io
sudo nginx -t && sudo systemctl reload nginx
```

Remarque : avec cette approche, vous devez recopier apres chaque modification.

## Verification

```bash
# Tester la syntaxe de la configuration
sudo nginx -t

# Verifier que les trois noms d'hôtes repondent
curl -I https://whynot.skrum.io
curl -I https://admin.whynot.skrum.io
curl -I https://superadmin.whynot.skrum.io
```

## Stripe Webhooks

Le point de terminaison `/api/webhooks/stripe` est accessible via les trois noms d'hôtes. Fixez l'URL du webhook a `https://whynot.skrum.io/api/webhooks/stripe` dans le tableau de bord Stripe pour eviter les incompatibilites de signature.

## Limitation de debit

Deux zones de limitation de debit sont configurees :

- `whynot_api_limit` : 30 req/s avec rafale de 50 pour les routes `/api/`.
- `whynot_auth_limit` : 5 req/s avec rafale de 10 pour les points d'authentification.

Les deux zones s'appliquent de maniere identique sur les trois noms d'hôtes.
