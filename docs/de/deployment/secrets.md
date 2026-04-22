---
title: "Geheimnisverwaltung"
description: "Beschreibung der Handhabung sensibler Konfigurationswerte in WhyNot ueber verschiedene Umgebungen hinweg."
lang: de
draft: true
---

# Geheimnisverwaltung

Dieses Dokument beschreibt, wie WhyNot sensible Konfigurationswerte ueber verschiedene Umgebungen hinweg handhabt.

## Grundsaetze

1. **Niemals Geheimnisse committen** — `.env` ist per gitignore ausgeschlossen. Nur `.env.example` (mit Platzhaltern) wird versioniert.
2. **Niemals Geheimnisse protokollieren** — Das Gateway-Konfigurationsmodul validiert Geheimnisse beim Start, schreibt deren Werte aber niemals in Logs.
3. **Sofort abbrechen** — Fehlende erforderliche Geheimnisse fuehren zu einem sofortigen Startabbruch mit einer klaren Fehlermeldung.

## Entwicklung

In der lokalen Entwicklung befinden sich Geheimnisse in Ihrer `.env`-Datei:

```bash
cp .env.example .env
# Fill in required values:
#   JWT_SECRET          — any long random string
#   SECRETS_ENCRYPTION_KEY — openssl rand -base64 32
#   ENCRYPTION_KEY      — any random string
```

Fuer die lokale Entwicklung koennen Sie Platzhalterwerte verwenden. OAuth- und Stripe-Funktionen sind ohne echte Anmeldedaten nicht verfuegbar.

## Produktion

In der Produktion sollten Geheimnisse aus der Host-Umgebung oder einem Secret-Manager stammen — **niemals** aus einer `.env`-Datei auf der Festplatte.

### Empfohlene Ansaetze

#### 1. Host-Umgebungsvariablen (einfachste Methode)

Setzen Sie Variablen direkt auf dem Host oder in Ihrer Deployment-Plattform:

```bash
# Example: systemd service
Environment="JWT_SECRET=<real-value>"
Environment="SECRETS_ENCRYPTION_KEY=<real-value>"

# Example: Docker run
docker run -e JWT_SECRET=<real-value> -e SECRETS_ENCRYPTION_KEY=<real-value> ...
```

#### 2. Docker Secrets (Swarm)

Fuer Docker-Swarm-Deployments verwenden Sie Docker Secrets:

```bash
echo "<real-jwt-secret>" | docker secret create jwt_secret -
```

#### 3. Cloud-Secret-Manager

- **AWS**: Secrets Manager oder SSM Parameter Store
- **GCP**: Secret Manager
- **Azure**: Key Vault

Injizieren Sie beim Containerstart ueber die native Secret-Einbindung Ihres Orchestrators.

## Geheimnisrotation

### JWT_SECRET

Das Rotieren von `JWT_SECRET` macht alle bestehenden Benutzersitzungen ungueltig. Fuer eine schrittweise Rotation:

1. Fuegen Sie das neue Geheimnis neben dem alten hinzu (wenn Ihre Auth-Middleware mehrere Schluessel unterstuetzt)
2. Deployen Sie mit dem neuen Geheimnis
3. Warten Sie, bis alte Tokens ablaufen (Standard: 7 Tage)
4. Entfernen Sie das alte Geheimnis

### SECRETS_ENCRYPTION_KEY / ENCRYPTION_KEY

Diese verschluesseln gespeicherte Anmeldedaten und Integrations-Token. Die Rotation erfordert eine Neuverschluesselung aller gespeicherten Werte:

1. Generieren Sie einen neuen Schluessel: `openssl rand -base64 32`
2. Fuehren Sie die Neuverschluesselungs-Migration aus (falls verfuegbar)
3. Deployen Sie mit dem neuen Schluessel

### Stripe-Schluessel

Stripe-Schluessel koennen im Stripe-Dashboard rotiert werden. Aktualisieren Sie die Umgebungsvariablen und deployen Sie erneut.

## Erforderliche Geheimnisse nach Umgebung

| Geheimnis | Entwicklung | Staging | Produktion |
|--------|-------------|---------|------------|
| `JWT_SECRET` | Platzhalter OK | Echter Wert | Echter Wert (stark) |
| `SECRETS_ENCRYPTION_KEY` | Kann entfallen (Funktion eingeschraenkt) | Echter Wert | Echter Wert |
| `ENCRYPTION_KEY` | Kann entfallen (Funktion eingeschraenkt) | Echter Wert | Echter Wert |
| `GITHUB_CLIENT_ID/SECRET` | Optional | Echter Wert | Echter Wert |
| `GOOGLE_CLIENT_ID/SECRET` | Optional | Echter Wert | Echter Wert |
| `STRIPE_SECRET_KEY` | Optional | Testmodus-Schluessel | Live-Modus-Schluessel |
| `STRIPE_WEBHOOK_SECRET` | Optional | Echter Wert | Echter Wert |
| `RESEND_API_KEY` | Optional | Echter Wert | Echter Wert |
| `ANTHROPIC_API_KEY` | Fuer KI erforderlich | Echter Wert | Echter Wert |

## Geheimnisse generieren

```bash
# JWT secret (64 bytes, base64-encoded)
openssl rand -base64 64

# Encryption key (32 bytes, base64-encoded — required format for AES-256)
openssl rand -base64 32

# Generic random string
openssl rand -hex 32
```
