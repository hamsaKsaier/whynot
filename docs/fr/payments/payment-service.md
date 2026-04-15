# Service de paiement

La classe `PaymentService` (`gateway/src/payments/payment-service.ts`) est le point d'entrée unique pour toutes les opérations de paiement dans whynot. Toute la logique métier appelle `PaymentService` — jamais le fournisseur Stripe directement.

## API publique

### `createCheckoutSession(params, ctx)`
Crée une session Stripe Checkout pour souscrire à un plan.

- **params**: `{ orgId, plan, tier, successUrl, cancelUrl }`
- **retourne**: `{ sessionId, url, idempotencyKey }`

### `createSubscription(params, ctx)`
Crée un abonnement dans la base de données locale et Stripe.

- **params**: `{ orgId, plan, tier }`
- **retourne**: `{ subscriptionId, stripeSubscriptionId, status }`

### `handleWebhook(event)`
Distribue les événements webhook Stripe.

### `refund(params, ctx)`
Traite un remboursement via Stripe.

- **params**: `{ paymentIntentId, amountCents? }` — `amountCents` est de type `bigint`
- **retourne**: `{ refundId, amountCents, status }`

### `chargePayg(params, ctx)`
Facture un montant PAYG (paiement à l'usage). Écrit une entrée `payg_credits_ledger` et crée un Stripe PaymentIntent.

- **params**: `{ orgId, amountCents, reason, relatedEventId? }` — `amountCents` est de type `bigint`
- **retourne**: `{ ledgerEntryId, paymentIntentId, amountCents }`

## La règle bigint

Toutes les valeurs monétaires sont en `bigint` centimes. N'utilisez jamais `number` ou `float` pour l'arithmétique monétaire.

## Retry + Idempotence

- **Retry**: Backoff exponentiel, max 3 tentatives. Ne réessaie que les erreurs transitoires (5xx, réseau).
- **Idempotence**: Clés UUID v4 générées par opération de création. Les résultats en cache sont retournés pour les clés dupliquées dans les 24h.

## Journalisation d'audit

Chaque méthode publique écrit dans `payment_audit_log`. **Jamais journalisé**: numéros de carte, CVV, email, nom, téléphone, adresse.
