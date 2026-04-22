---
title: "Guia de configuracion de Stripe"
description: "Instrucciones completas para configurar los pagos de Stripe en WhyNot QA."
lang: es
draft: false
---

# Guia de configuracion de Stripe

Instrucciones completas para configurar los pagos de Stripe en WhyNot QA.

## Requisitos previos

- Una cuenta de Stripe ([stripe.com](https://stripe.com))
- Stripe CLI instalado ([stripe.com/docs/stripe-cli](https://stripe.com/docs/stripe-cli))
- La plataforma WhyNot en ejecucion via Docker (`make start`)

## 1. Configuracion del panel de Stripe

### Activar el modo de prueba

1. Inicie sesion en el panel de Stripe.
2. Active **Test mode** en la esquina superior derecha.
3. Todos los pasos siguientes utilizan datos del modo de prueba.

### Crear productos

Cree los siguientes productos en **Products > + Add product**:

| Nombre del producto | Modelo de precios |
|---|---|
| WhyNot Starter | Recurrente (mensual + anual) |
| WhyNot Pro | Recurrente (mensual + anual) |
| WhyNot Business | Recurrente (mensual + anual) |
| WhyNot Enterprise | Recurrente (mensual + anual) |
| PAYG | Uso medido |

Para cada producto recurrente, cree dos precios (mensual y anual). Para PAYG, cree un unico precio medido.

### Copiar los IDs de precios

Despues de crear los productos, copie cada ID `price_...` en su archivo `.env`:

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

## 2. Claves API

1. Vaya a **Developers > API keys**.
2. Copie la **Secret key** (`sk_test_...`) en `STRIPE_SECRET_KEY`.
3. Copie la **Publishable key** (`pk_test_...`) en `STRIPE_PUBLISHABLE_KEY`.

```bash
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
```

## 3. Configuracion de webhooks

### Produccion / Staging

1. Vaya a **Developers > Webhooks > + Add endpoint**.
2. Configure la URL como: `https://superadmin.whynot.skrum.io/api/webhooks/stripe`
3. Seleccione los eventos a escuchar:
   - `checkout.session.completed`
   - `invoice.paid`
   - `invoice.payment_failed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `charge.refunded`
   - `charge.dispute.created`
4. Copie el **Signing secret** (`whsec_...`) en `STRIPE_WEBHOOK_SECRET`.

### Desarrollo local

Utilice la CLI de Stripe para reenviar webhooks a su gateway local:

```bash
stripe listen --forward-to localhost:3010/api/webhooks/stripe
```

La CLI imprime un secreto de firma de webhook al iniciar. Copielo:

```bash
STRIPE_WEBHOOK_SECRET=whsec_...  # from stripe listen output
```

Mantenga `stripe listen` ejecutandose en una terminal separada mientras desarrolla.

## 4. Resumen de variables de entorno

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

## 5. Numeros de tarjetas de prueba

| Numero de tarjeta | Escenario |
|---|---|
| `4242 4242 4242 4242` | Pago exitoso |
| `4000 0000 0000 3220` | Autenticacion 3D Secure requerida |
| `4000 0000 0000 0341` | Se vincula correctamente, falla al cobrar |
| `4000 0000 0000 9995` | Rechazo por fondos insuficientes |
| `4000 0000 0000 0069` | Rechazo por tarjeta expirada |
| `4000 0000 0000 0127` | Rechazo por CVC incorrecto |
| `4000 0000 0000 0002` | Rechazo generico |

Utilice cualquier fecha de expiracion futura (por ejemplo, `12/34`), cualquier CVC de 3 digitos y cualquier codigo postal.

## 6. Probar el flujo completo

1. **Iniciar la plataforma**: `make start`
2. **Iniciar el listener de Stripe**: `stripe listen --forward-to localhost:3010/api/webhooks/stripe`
3. **Registrarse** como nuevo usuario en `http://localhost:5183`
4. **Iniciar prueba gratuita**: El sistema aprovisiona automaticamente una suscripcion de prueba.
5. **Actualizar plan**: Haga clic en "Upgrade" y use la tarjeta de prueba `4242 4242 4242 4242`.
6. **Verificar**: Compruebe la fila de suscripcion en la base de datos y en el panel de Stripe.
7. **Cancelar**: Cancele desde la pagina de facturacion. Verifique `cancel_at_period_end`.
8. **Reactivar**: Reactive antes de que termine el periodo.
9. **Probar fallo**: Use la tarjeta `4000 0000 0000 0341` para activar `invoice.payment_failed`.
10. **Reembolso**: Emita un reembolso desde la interfaz de administracion.

## 7. Paso a produccion

1. Complete la lista de verificacion de activacion de Stripe en el panel.
2. Desactive el modo de prueba.
3. Cree productos y precios de produccion (misma estructura que los de prueba).
4. Actualice `.env` con las claves de produccion (`sk_live_...`, `pk_live_...`).
5. Cree un endpoint de webhook de produccion con los mismos eventos.
6. Actualice `STRIPE_WEBHOOK_SECRET` con el secreto de firma de produccion.
7. Actualice `STRIPE_SUCCESS_URL` y `STRIPE_CANCEL_URL` con las URLs de produccion.

**Nunca suba claves de Stripe de produccion al control de versiones.**

## 8. Paginas de facturacion del administrador

El panel de administracion en `http://localhost:5184` ofrece:

- **Planes**: Crear, editar, archivar y sincronizar planes con Stripe.
- **Suscripciones**: Ver todas las suscripciones de los espacios de trabajo con filtros de estado.
- **Creditos**: Otorgar creditos manuales y exportar datos de creditos.
- **Configuracion de facturacion**: Configurar dias de prueba, periodo de gracia y tarifas PAYG.

Al editar un plan en la interfaz de administracion, se crea o actualiza automaticamente el producto y precio correspondiente en Stripe a traves de la API.
