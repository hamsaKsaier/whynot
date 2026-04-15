# Guia de solucion de problemas de pagos

Problemas comunes y soluciones para la integracion de pagos con Stripe en WhyNot QA.

## Problemas de webhooks

### Los webhooks no se activan

**Sintomas**: El estado de la suscripcion no se actualiza despues del checkout, las facturas no se registran.

**Soluciones**:
1. Verifique que `stripe listen` este en ejecucion (desarrollo local):
   ```bash
   stripe listen --forward-to localhost:3010/api/webhooks/stripe
   ```
2. Revise el panel de Stripe en **Developers > Webhooks** para ver entregas fallidas.
3. Verifique que `STRIPE_WEBHOOK_SECRET` coincida con el secreto de firma de `stripe listen` o del panel.
4. Asegurese de que el contenedor del gateway este en ejecucion: `docker ps | grep gateway`.

### Verificacion de firma fallida (400)

**Sintomas**: El webhook devuelve `400 Signature verification failed`.

**Causas**:
- `STRIPE_WEBHOOK_SECRET` es incorrecto o pertenece a un endpoint diferente.
- El cuerpo de la solicitud fue parseado antes de llegar al handler del webhook (el cuerpo debe llegar como buffer sin procesar).
- Desfase de reloj entre su servidor y Stripe (la firma tiene una tolerancia de aproximadamente 5 minutos).

**Soluciones**:
1. Regenere el secreto de firma del webhook en el panel de Stripe.
2. Para desarrollo local, reinicie `stripe listen` y copie el nuevo secreto.
3. Verifique que su proxy inverso no este modificando el cuerpo de la solicitud.

### Entregas de webhook duplicadas

**Sintomas**: Stripe reintenta los webhooks multiples veces.

**Explicacion**: Stripe reintenta si no recibe una respuesta `2xx` dentro de 20 segundos. La tabla de idempotencia (`payment_webhooks_idempotency`) previene el procesamiento duplicado. Si ve reintentos en el panel de Stripe, verifique:
1. Los logs del gateway en busca de errores durante el manejo del webhook.
2. La conectividad con la base de datos (el INSERT de idempotencia debe completarse correctamente).
3. El tiempo de respuesta (el handler debe responder dentro de 20 segundos).

## Rechazos de tarjeta

### Rechazo generico

**Error**: `billing.cardDeclined`

La tarjeta fue rechazada por el banco emisor. Solicite al cliente que:
- Intente con una tarjeta diferente.
- Contacte a su banco para autorizar el cargo.
- Verifique si hay bloqueos de prevencion de fraude.

### Fondos insuficientes

**Error**: `billing.insufficientFunds`

La tarjeta no tiene saldo suficiente. Solicite al cliente que use una tarjeta diferente o agregue fondos.

### Tarjeta expirada

**Error**: `billing.expiredCard`

La fecha de expiracion de la tarjeta ya paso. Solicite al cliente que actualice su metodo de pago.

### Autenticacion 3D Secure requerida

**Error**: `billing.authenticationRequired`

La tarjeta requiere autenticacion adicional (3DS/SCA). El cliente debe completar el flujo de autenticacion en su navegador. Esto es comun en tarjetas europeas bajo las regulaciones PSD2/SCA.

## Problemas de suscripcion

### Suscripcion no encontrada despues del checkout

**Causa**: El webhook `checkout.session.completed` aun no ha sido procesado.

**Soluciones**:
1. Verifique si el webhook fue recibido (panel de Stripe > Webhooks > Recent events).
2. Verifique que la tabla de idempotencia contenga el ID del evento.
3. Revise los logs del gateway en busca de errores durante `handleCheckoutCompleted`.

### La prueba gratuita no se inicia

**Causa**: El metodo `provisionNewWorkspace` no fue llamado o el valor de `trial_days` en la configuracion de facturacion esta en 0.

**Soluciones**:
1. Verifique el valor de `trial_days` en la tabla `billing_config`.
2. Verifique que la creacion del espacio de trabajo active el aprovisionamiento de la suscripcion.

### Suscripcion atascada en `past_due`

**Causa**: El pago de una factura fallo y no se ha reintentado con exito.

**Soluciones**:
1. El cliente actualiza su metodo de pago a traves del portal de facturacion.
2. El administrador reintenta manualmente la factura en el panel de Stripe.
3. Stripe reintenta automaticamente segun el calendario de reintentos (configurado en el panel de Stripe > Settings > Billing > Subscriptions > Retry schedule).

## Problemas de PAYG

### Cargo PAYG fallido

**Causa**: El metodo de pago almacenado fue rechazado al cobrar automaticamente un saldo PAYG negativo.

**Soluciones**:
1. El cliente agrega un metodo de pago valido.
2. El administrador recarga manualmente el saldo del espacio de trabajo desde la pagina de Creditos.
3. Verifique la tabla `payg_credits_ledger` para la entrada fallida.

### Los creditos no se descuentan

**Causa**: El middleware `credit-gate` puede no estar aplicado a la ruta, o `deductCredits` no se llama despues de la operacion.

**Soluciones**:
1. Verifique que la ruta utilice el middleware `requireCredits()`.
2. Verifique que `deductCredits()` se llame en el handler de la ruta despues del exito.

## Problemas de reembolso

### Reembolso fallido

**Error**: `billing.refundFailed`

**Causas**:
- El cargo es demasiado antiguo (Stripe permite reembolsos dentro de 180 dias).
- El cargo ya fue reembolsado completamente.
- El saldo de la cuenta de Stripe es insuficiente para el reembolso.

**Soluciones**:
1. Verifique el cargo en el panel de Stripe.
2. Para reembolsos parciales, verifique el monto reembolsable restante.
3. Contacte al soporte de Stripe si el reembolso esta bloqueado.

## Problemas de entorno

### Claves de Stripe faltantes

**Sintomas**: `Error: Stripe secret key not configured`

**Solucion**: Asegurese de que todas las variables de entorno requeridas esten configuradas en `.env`:
```bash
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

### Entorno incorrecto (prueba vs produccion)

**Sintomas**: Las llamadas a la API fallan con errores de autenticacion, o los cargos aparecen en tarjetas reales.

**Solucion**: Verifique que esta usando el prefijo de clave correcto:
- Modo de prueba: `sk_test_...`, `pk_test_...`
- Modo de produccion: `sk_live_...`, `pk_live_...`

Nunca mezcle claves de prueba y produccion.

## Problemas de base de datos

### Tabla de idempotencia faltante

**Sintomas**: `500 Internal error` en el endpoint del webhook.

**Solucion**: Ejecute las migraciones de la base de datos:
```bash
make shell-gateway npm run migrate
```

### Fila de suscripcion no creada

**Causa**: El INSERT en la tabla `workspace_subscriptions` fallo.

**Soluciones**:
1. Revise los logs del gateway en busca de errores SQL.
2. Verifique que el ID del espacio de trabajo exista en la tabla `workspaces`.
3. Verifique si hay violaciones de restriccion unica (suscripcion duplicada).

## Consejos de depuracion

1. **Panel de Stripe**: Siempre revise **Developers > Events** para el registro completo de eventos.
2. **Logs del gateway**: `docker logs whynot-gateway-1 --tail 100 -f`
3. **Eventos de la CLI de Stripe**: `stripe events list --limit 10`
4. **Probar webhooks manualmente**: `stripe trigger checkout.session.completed`
5. **Verificar idempotencia**: Consulte la tabla `payment_webhooks_idempotency` para el estado de procesamiento de eventos.
6. **Registro de auditoria**: Consulte la tabla `payment_audit_log` para el historial de operaciones de pago.
