# Nginx Setup

WhyNot uses a single Nginx configuration file to serve three hostnames:

| Hostname | Upstream | Port |
|----------|----------|------|
| `whynot.skrum.io` | Frontend SPA | 5183 |
| `admin.whynot.skrum.io` | Admin Frontend SPA | 5184 |
| `superadmin.whynot.skrum.io` | Admin Frontend SPA (superadmin namespace) | 5184 |

`superadmin.whynot.skrum.io` is a hostname alias that proxies to the same admin-frontend upstream. The SPA detects the hostname and restricts the UI to superadmin-only sections.

## Prerequisites

- DNS: A/AAAA records for all three hostnames must point to the server.
- Nginx installed on the host.
- Certbot installed for TLS certificate provisioning.

## Installation

The configuration file lives in the repository at `docker/nginx/whynot.skrum.io`. Use a symlink so future edits auto-propagate:

```bash
# Remove old non-versioned config if it exists
sudo rm -f /etc/nginx/sites-available/whynot
sudo rm -f /etc/nginx/sites-enabled/whynot

# Symlink from repo
sudo ln -sf /home/serverlessbase/whynot/docker/nginx/whynot.skrum.io \
            /etc/nginx/sites-available/whynot.skrum.io
sudo ln -sf /etc/nginx/sites-available/whynot.skrum.io \
            /etc/nginx/sites-enabled/whynot.skrum.io

# Test and reload
sudo nginx -t && sudo systemctl reload nginx
```

## TLS with Certbot

Run Certbot with all three hostnames:

```bash
sudo certbot --nginx \
  -d whynot.skrum.io \
  -d admin.whynot.skrum.io \
  -d superadmin.whynot.skrum.io
```

Certbot automatically adds `listen 443 ssl` blocks and `ssl_*` directives. Renewal covers all three hostnames.

## Manual Sync (Alternative)

If you prefer copying over symlinking:

```bash
sudo cp /home/serverlessbase/whynot/docker/nginx/whynot.skrum.io \
        /etc/nginx/sites-available/whynot.skrum.io
sudo nginx -t && sudo systemctl reload nginx
```

Note: with this approach, you must re-copy after every change.

## Verification

```bash
# Test config syntax
sudo nginx -t

# Check all three hostnames respond
curl -I https://whynot.skrum.io
curl -I https://admin.whynot.skrum.io
curl -I https://superadmin.whynot.skrum.io
```

## Stripe Webhooks

The `/api/webhooks/stripe` endpoint is accessible via all three hostnames. Pin the webhook URL to `https://whynot.skrum.io/api/webhooks/stripe` in the Stripe Dashboard to avoid signature mismatches.

## Rate Limiting

Two rate-limiting zones are configured:

- `whynot_api_limit`: 30 req/s with burst of 50 for `/api/` routes.
- `whynot_auth_limit`: 5 req/s with burst of 10 for auth endpoints.

Both zones apply identically across all three hostnames.
