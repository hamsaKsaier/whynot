---
title: "Zahlungsservice"
description: "Dokumentation der PaymentService-Klasse als zentraler Einstiegspunkt fuer alle Zahlungsoperationen."
lang: de
draft: false
---

# Zahlungsservice

Die Klasse `PaymentService` (`gateway/src/payments/payment-service.ts`) ist der einzige Einstiegspunkt für alle Zahlungsoperationen in whynot. Jede Geschäftslogik ruft `PaymentService` auf — niemals den Stripe-Provider direkt.

## Öffentliche API

### `createCheckoutSession(params, ctx)`
Erstellt eine Stripe Checkout-Sitzung zur Abonnierung eines Plans.

- **params**: `{ orgId, plan, tier, successUrl, cancelUrl }`
- **gibt zurück**: `{ sessionId, url, idempotencyKey }`

### `createSubscription(params, ctx)`
Erstellt ein Abonnement in der lokalen Datenbank und bei Stripe.

- **params**: `{ orgId, plan, tier }`
- **gibt zurück**: `{ subscriptionId, stripeSubscriptionId, status }`

### `handleWebhook(event)`
Verteilt Stripe-Webhook-Ereignisse.

### `refund(params, ctx)`
Verarbeitet eine Rückerstattung über Stripe.

- **params**: `{ paymentIntentId, amountCents? }` — `amountCents` ist vom Typ `bigint`
- **gibt zurück**: `{ refundId, amountCents, status }`

### `chargePayg(params, ctx)`
Berechnet einen PAYG-Betrag (nutzungsbasiert). Schreibt einen `payg_credits_ledger`-Eintrag und erstellt einen Stripe PaymentIntent.

- **params**: `{ orgId, amountCents, reason, relatedEventId? }` — `amountCents` ist vom Typ `bigint`
- **gibt zurück**: `{ ledgerEntryId, paymentIntentId, amountCents }`

## Die Bigint-Regel

Alle Geldwerte sind `bigint` in Cent. Verwenden Sie niemals `number` oder `float` für Geldberechnungen.

## Retry + Idempotenz

- **Retry**: Exponentieller Backoff, max. 3 Versuche. Wiederholt nur transiente Fehler (5xx, Netzwerk).
- **Idempotenz**: UUID-v4-Schlüssel pro Erstellungsoperation generiert. Gecachte Ergebnisse werden für doppelte Schlüssel innerhalb von 24h zurückgegeben.

## Audit-Protokollierung

Jede öffentliche Methode schreibt in `payment_audit_log`. **Nie protokolliert**: Kartennummern, CVV, E-Mail, Name, Telefon, Adresse.
