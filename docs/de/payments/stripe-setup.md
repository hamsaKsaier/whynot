# Stripe-Einrichtungsanleitung

Vollstaendige Anleitung zur Konfiguration von Stripe-Zahlungen in WhyNot QA.

## Voraussetzungen

- Ein Stripe-Konto ([stripe.com](https://stripe.com))
- Stripe CLI installiert ([stripe.com/docs/stripe-cli](https://stripe.com/docs/stripe-cli))
- WhyNot-Plattform laeuft via Docker (`make start`)

## 1. Stripe-Dashboard-Einrichtung

### Testmodus aktivieren

1. Melden Sie sich im Stripe-Dashboard an.
2. Aktivieren Sie den **Testmodus** oben rechts.
3. Alle folgenden Schritte verwenden Testmodus-Daten.

### Produkte erstellen

Erstellen Sie die folgenden Produkte unter **Products > + Add product**:

| Produktname | Preismodell |
|---|---|
| WhyNot Starter | Wiederkehrend (monatlich + jaehrlich) |
| WhyNot Pro | Wiederkehrend (monatlich + jaehrlich) |
| WhyNot Business | Wiederkehrend (monatlich + jaehrlich) |
| WhyNot Enterprise | Wiederkehrend (monatlich + jaehrlich) |
| PAYG | Nutzungsbasiert (metered) |

Erstellen Sie fuer jedes wiederkehrende Produkt zwei Preise (monatlich und jaehrlich). Fuer PAYG erstellen Sie einen einzelnen nutzungsbasierten Preis.

### Preis-IDs kopieren

Kopieren Sie nach dem Erstellen der Produkte jede `price_...`-ID in Ihre `.env`-Datei:

```bash
STRIPE_PRICE_STARTER_MONTHLY=price_...
STRIPE_PRICE_STARTER_YEARLY=price_...
STRIPE_PRICE_PRO_MONTHLY=price_...
STRIPE_PRICE_PRO_YEARLY=price_...
STRIPE_PRICE_BUSINESS_MONTHLY=price_...
STRIPE_PRICE_BUSINESS_YEARLY=price_...
STRIPE_PRICE_ENTERPRISE_MONTHLY=price_...
STRIPE_PRICE_ENTERPRISE_YEARLY=price_...
STRIPE_PRICE_PAYG_METERED=price_...
```

## 2. API-Schluessel

1. Gehen Sie zu **Developers > API keys**.
2. Kopieren Sie den **Secret key** (`sk_test_...`) in `STRIPE_SECRET_KEY`.
3. Kopieren Sie den **Publishable key** (`pk_test_...`) in `STRIPE_PUBLISHABLE_KEY`.

```bash
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
```

## 3. Webhook-Konfiguration

### Produktion / Staging

1. Gehen Sie zu **Developers > Webhooks > + Add endpoint**.
2. Setzen Sie die URL auf: `https://superadmin.whynot.skrum.io/api/webhooks/stripe`
3. Waehlen Sie die folgenden Events aus:
   - `checkout.session.completed`
   - `invoice.paid`
   - `invoice.payment_failed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `charge.refunded`
   - `charge.dispute.created`
4. Kopieren Sie das **Signing secret** (`whsec_...`) in `STRIPE_WEBHOOK_SECRET`.

### Lokale Entwicklung

Verwenden Sie die Stripe CLI, um Webhooks an Ihr lokales Gateway weiterzuleiten:

```bash
stripe listen --forward-to localhost:3010/api/webhooks/stripe
```

Die CLI gibt beim Start ein Webhook-Signing-Secret aus. Kopieren Sie es:

```bash
STRIPE_WEBHOOK_SECRET=whsec_...  # aus der stripe listen Ausgabe
```

Lassen Sie `stripe listen` waehrend der Entwicklung in einem separaten Terminal laufen.

## 4. Zusammenfassung der Umgebungsvariablen

```bash
# .env
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

STRIPE_PRICE_STARTER_MONTHLY=price_...
STRIPE_PRICE_STARTER_YEARLY=price_...
STRIPE_PRICE_PRO_MONTHLY=price_...
STRIPE_PRICE_PRO_YEARLY=price_...
STRIPE_PRICE_BUSINESS_MONTHLY=price_...
STRIPE_PRICE_BUSINESS_YEARLY=price_...
STRIPE_PRICE_ENTERPRISE_MONTHLY=price_...
STRIPE_PRICE_ENTERPRISE_YEARLY=price_...
STRIPE_PRICE_PAYG_METERED=price_...

STRIPE_SUCCESS_URL=http://localhost:5183/billing?success=true
STRIPE_CANCEL_URL=http://localhost:5183/billing?canceled=true
```

## 5. Test-Kartennummern

| Kartennummer | Szenario |
|---|---|
| `4242 4242 4242 4242` | Erfolgreiche Zahlung |
| `4000 0000 0000 3220` | 3D-Secure-Authentifizierung erforderlich |
| `4000 0000 0000 0341` | Wird erfolgreich hinzugefuegt, schlaegt bei Belastung fehl |
| `4000 0000 0000 9995` | Ablehnung wegen unzureichendem Guthaben |
| `4000 0000 0000 0069` | Ablehnung wegen abgelaufener Karte |
| `4000 0000 0000 0127` | Ablehnung wegen falscher CVC |
| `4000 0000 0000 0002` | Generische Ablehnung |

Verwenden Sie ein beliebiges zukuenftiges Ablaufdatum (z. B. `12/34`), eine beliebige dreistellige CVC und eine beliebige Postleitzahl.

## 6. Vollstaendigen Ablauf testen

1. **Plattform starten**: `make start`
2. **Stripe-Listener starten**: `stripe listen --forward-to localhost:3010/api/webhooks/stripe`
3. **Registrieren**: Erstellen Sie ein neues Benutzerkonto unter `http://localhost:5183`
4. **Testphase starten**: Das System erstellt automatisch ein Test-Abonnement.
5. **Upgrade durchfuehren**: Klicken Sie auf "Upgrade" und verwenden Sie die Testkarte `4242 4242 4242 4242`.
6. **Ueberpruefen**: Pruefen Sie die Abonnement-Zeile in der Datenbank und im Stripe-Dashboard.
7. **Kuendigen**: Kuendigen Sie ueber die Abrechnungsseite. Ueberpruefen Sie `cancel_at_period_end`.
8. **Reaktivieren**: Reaktivieren Sie vor Ablauf des Zeitraums.
9. **Fehler testen**: Verwenden Sie die Karte `4000 0000 0000 0341`, um `invoice.payment_failed` auszuloesen.
10. **Rueckerstattung**: Erstatten Sie eine Zahlung ueber die Admin-Oberflaeche.

## 7. Produktivbetrieb

1. Vervollstaendigen Sie die Stripe-Aktivierungscheckliste im Dashboard.
2. Deaktivieren Sie den Testmodus.
3. Erstellen Sie Produktionsprodukte und -preise (gleiche Struktur wie im Test).
4. Aktualisieren Sie `.env` mit Live-Schluesseln (`sk_live_...`, `pk_live_...`).
5. Erstellen Sie einen Produktions-Webhook-Endpoint mit denselben Events.
6. Aktualisieren Sie `STRIPE_WEBHOOK_SECRET` mit dem Produktions-Signing-Secret.
7. Aktualisieren Sie `STRIPE_SUCCESS_URL` und `STRIPE_CANCEL_URL` auf Produktions-URLs.

**Committen Sie niemals Live-Stripe-Schluessel in die Versionskontrolle.**

## 8. Admin-Abrechnungsseiten

Das Admin-Panel unter `http://localhost:5184` bietet:

- **Tarife**: Erstellen, Bearbeiten, Archivieren und Synchronisieren von Tarifen mit Stripe.
- **Abonnements**: Alle Workspace-Abonnements mit Statusfiltern anzeigen.
- **Guthaben**: Manuelles Guthaben zuweisen und Guthabendaten exportieren.
- **Abrechnungskonfiguration**: Testzeitraum, Karenzzeit und PAYG-Tarife konfigurieren.

Das Bearbeiten eines Tarifs in der Admin-Oberflaeche erstellt oder aktualisiert automatisch das entsprechende Stripe-Produkt und den Preis ueber die API.
