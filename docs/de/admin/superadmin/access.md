---
title: "Superadmin-Zugang"
description: "Beschreibung des Superadmin-Bereichs und seiner Zugangssteuerung in WhyNot QA."
lang: de
draft: false
---

# Superadmin-Zugang

## Uebersicht

Der Superadmin-Bereich ist unter `https://superadmin.whynot.skrum.io` erreichbar. Er stellt dieselbe Admin-Frontend-Anwendung bereit, jedoch mit eingeschraenktem Navigationsumfang und hostname-abhaengigem Verhalten.

## Wer hat Zugang

Nur Benutzer mit der Rolle `super_admin` koennen auf den Superadmin-Hostnamen zugreifen. Dies wird auf zwei Ebenen durchgesetzt:

1. **Authentifizierung**: Der Anmeldevorgang erfordert die Rolle `super_admin`. Nicht-Superadmin-Benutzer erhalten einen Fehler "Zugriff verweigert".
2. **Hostname-Pruefung**: Wenn ein Benutzer `superadmin.whynot.skrum.io` ohne die Rolle `super_admin` erreicht, sieht er eine klare Seite "Zugriff verweigert" mit Weiterleitung zu `admin.whynot.skrum.io`.

## Unterschiede zu admin.whynot.skrum.io

| Verhalten | admin.whynot.skrum.io | superadmin.whynot.skrum.io |
|-----------|----------------------|---------------------------|
| Seitenleisten-Abschnitte | Alle Abschnitte | Nur Plattform, Abrechnung, Flags & KI, Einstellungen |
| Weiterleitung nach Anmeldung | `/` (Dashboard) | `/users` |
| Seitenleisten-Titel | "Admin" | "Super Admin" |
| Zugriff-verweigert-Ablauf | Generische Verbotsseite | Dedizierte Seite mit Weiterleitung zu Admin |

## Funktionsweise

Das Admin-Frontend erkennt den Hostnamen ueber `window.location.hostname` mithilfe des Helpers in `src/lib/hostname.ts`. Basierend auf dem erkannten Modus (`"admin"` oder `"superadmin"`):

- **AdminShell** filtert die Navigationsabschnitte der Seitenleiste.
- **LoginPage** leitet nach erfolgreicher Anmeldung zu `/users` statt `/` weiter.
- **ProtectedRoute** zeigt `AccessDeniedPage` statt `ForbiddenPage` fuer Nicht-Superadmin-Benutzer auf dem Superadmin-Hostnamen an.

## Unterstuetzte Hostnamen

| Hostname | Modus |
|----------|-------|
| `superadmin.whynot.skrum.io` | `superadmin` |
| `superadmin.localhost` | `superadmin` (Entwicklung) |
| Jeder andere | `admin` |

## Hinzufuegen des Superadmin-Hostnamens

Es ist kein separates SPA-Deployment erforderlich. Der Superadmin-Hostname ist ein Nginx-Alias, der auf denselben `admin-frontend`-Upstream (Port 5184) zeigt. Siehe [Nginx-Einrichtung](../../deployment/nginx-setup.md) fuer Konfigurationsdetails.

### DNS

Erstellen Sie einen A/AAAA-Eintrag fuer `superadmin.whynot.skrum.io`, der auf dieselbe IP wie `whynot.skrum.io` zeigt.

### CORS

Der Gateway muss `https://superadmin.whynot.skrum.io` in seiner CORS-Whitelist enthalten. Setzen Sie `SUPERADMIN_FRONTEND_URL=https://superadmin.whynot.skrum.io` in der `.env`-Datei.
