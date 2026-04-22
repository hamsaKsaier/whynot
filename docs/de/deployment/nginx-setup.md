---
title: "Nginx-Einrichtung"
description: "Anleitung zur Nginx-Konfiguration fuer die drei WhyNot-Hostnamen."
lang: de
draft: false
---

# Nginx-Einrichtung

WhyNot verwendet eine einzige Nginx-Konfigurationsdatei fuer drei Hostnamen:

| Hostname | Upstream | Port |
|----------|----------|------|
| `whynot.skrum.io` | Frontend SPA | 5183 |
| `admin.whynot.skrum.io` | Admin Frontend SPA | 5184 |
| `superadmin.whynot.skrum.io` | Admin Frontend SPA (Superadmin-Bereich) | 5184 |

`superadmin.whynot.skrum.io` ist ein Hostname-Alias, der auf denselben Admin-Frontend-Upstream weiterleitet. Die SPA erkennt den Hostnamen und beschraenkt die Oberflaeche auf Superadmin-Bereiche.

## Voraussetzungen

- DNS: A/AAAA-Eintraege fuer alle drei Hostnamen muessen auf den Server zeigen.
- Nginx auf dem Host installiert.
- Certbot fuer die TLS-Zertifikatbereitstellung installiert.

## Installation

Die Konfigurationsdatei befindet sich im Repository unter `docker/nginx/whynot.skrum.io`. Verwenden Sie einen symbolischen Link, damit Aenderungen automatisch wirksam werden:

```bash
# Alte nicht versionierte Konfiguration entfernen, falls vorhanden
sudo rm -f /etc/nginx/sites-available/whynot
sudo rm -f /etc/nginx/sites-enabled/whynot

# Symbolischer Link vom Repository
sudo ln -sf /home/serverlessbase/whynot/docker/nginx/whynot.skrum.io \
            /etc/nginx/sites-available/whynot.skrum.io
sudo ln -sf /etc/nginx/sites-available/whynot.skrum.io \
            /etc/nginx/sites-enabled/whynot.skrum.io

# Testen und neu laden
sudo nginx -t && sudo systemctl reload nginx
```

## TLS mit Certbot

Fuehren Sie Certbot mit allen drei Hostnamen aus:

```bash
sudo certbot --nginx \
  -d whynot.skrum.io \
  -d admin.whynot.skrum.io \
  -d superadmin.whynot.skrum.io
```

Certbot fuegt automatisch `listen 443 ssl`-Bloecke und `ssl_*`-Direktiven hinzu. Die Erneuerung deckt alle drei Hostnamen ab.

## Manuelle Synchronisation (Alternative)

Wenn Sie das Kopieren dem symbolischen Link vorziehen:

```bash
sudo cp /home/serverlessbase/whynot/docker/nginx/whynot.skrum.io \
        /etc/nginx/sites-available/whynot.skrum.io
sudo nginx -t && sudo systemctl reload nginx
```

Hinweis: Bei diesem Ansatz muessen Sie nach jeder Aenderung erneut kopieren.

## Ueberpruefung

```bash
# Konfigurationssyntax testen
sudo nginx -t

# Pruefen, ob alle drei Hostnamen antworten
curl -I https://whynot.skrum.io
curl -I https://admin.whynot.skrum.io
curl -I https://superadmin.whynot.skrum.io
```

## Stripe Webhooks

Der Endpunkt `/api/webhooks/stripe` ist ueber alle drei Hostnamen erreichbar. Fixieren Sie die Webhook-URL auf `https://whynot.skrum.io/api/webhooks/stripe` im Stripe-Dashboard, um Signatur-Abweichungen zu vermeiden.

## Ratenbegrenzung

Zwei Ratenbegrenzungszonen sind konfiguriert:

- `whynot_api_limit`: 30 Anfragen/s mit Burst von 50 fuer `/api/`-Routen.
- `whynot_auth_limit`: 5 Anfragen/s mit Burst von 10 fuer Authentifizierungsendpunkte.

Beide Zonen gelten identisch fuer alle drei Hostnamen.
