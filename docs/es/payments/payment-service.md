# Servicio de pagos

La clase `PaymentService` (`gateway/src/payments/payment-service.ts`) es el punto de entrada único para todas las operaciones de pago en whynot. Toda la lógica de negocio llama a `PaymentService` — nunca al proveedor de Stripe directamente.

## API pública

### `createCheckoutSession(params, ctx)`
Crea una sesión de Stripe Checkout para suscribirse a un plan.

- **params**: `{ orgId, plan, tier, successUrl, cancelUrl }`
- **devuelve**: `{ sessionId, url, idempotencyKey }`

### `createSubscription(params, ctx)`
Crea una suscripción en la base de datos local y en Stripe.

- **params**: `{ orgId, plan, tier }`
- **devuelve**: `{ subscriptionId, stripeSubscriptionId, status }`

### `handleWebhook(event)`
Distribuye los eventos webhook de Stripe.

### `refund(params, ctx)`
Procesa un reembolso a través de Stripe.

- **params**: `{ paymentIntentId, amountCents? }` — `amountCents` es de tipo `bigint`
- **devuelve**: `{ refundId, amountCents, status }`

### `chargePayg(params, ctx)`
Cobra un monto PAYG (pago por uso). Escribe una entrada en `payg_credits_ledger` y crea un Stripe PaymentIntent.

- **params**: `{ orgId, amountCents, reason, relatedEventId? }` — `amountCents` es de tipo `bigint`
- **devuelve**: `{ ledgerEntryId, paymentIntentId, amountCents }`

## La regla de bigint

Todos los valores monetarios son `bigint` en centavos. Nunca use `number` o `float` para aritmética monetaria.

## Retry + Idempotencia

- **Retry**: Backoff exponencial, máximo 3 intentos. Solo reintenta errores transitorios (5xx, red).
- **Idempotencia**: Claves UUID v4 generadas por operación de creación. Los resultados en caché se devuelven para claves duplicadas dentro de 24h.

## Registro de auditoría

Cada método público escribe en `payment_audit_log`. **Nunca registrado**: números de tarjeta, CVV, correo electrónico, nombre, teléfono, dirección.
