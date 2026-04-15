# خدمة الدفع

فئة `PaymentService` (`gateway/src/payments/payment-service.ts`) هي نقطة الدخول الوحيدة لجميع عمليات الدفع في whynot. جميع عمليات الأعمال تستدعي `PaymentService` — لا يتم استدعاء مزود Stripe مباشرةً.

## واجهة برمجة التطبيقات العامة

### `createCheckoutSession(params, ctx)`
ينشئ جلسة Stripe Checkout للاشتراك في خطة.

- **params**: `{ orgId, plan, tier, successUrl, cancelUrl }`
- **يُرجع**: `{ sessionId, url, idempotencyKey }`

### `createSubscription(params, ctx)`
ينشئ اشتراكًا في قاعدة البيانات المحلية و Stripe.

- **params**: `{ orgId, plan, tier }`
- **يُرجع**: `{ subscriptionId, stripeSubscriptionId, status }`

### `handleWebhook(event)`
يوزع أحداث Stripe webhook.

### `refund(params, ctx)`
يعالج استردادًا عبر Stripe.

- **params**: `{ paymentIntentId, amountCents? }` — `amountCents` من نوع `bigint`
- **يُرجع**: `{ refundId, amountCents, status }`

### `chargePayg(params, ctx)`
يفرض رسوم الدفع حسب الاستخدام. يكتب صفًا في `payg_credits_ledger` وينشئ Stripe PaymentIntent.

- **params**: `{ orgId, amountCents, reason, relatedEventId? }` — `amountCents` من نوع `bigint`
- **يُرجع**: `{ ledgerEntryId, paymentIntentId, amountCents }`

## قاعدة bigint

جميع القيم المالية هي `bigint` بالسنتات. لا تستخدم `number` أو `float` أبدًا للعمليات الحسابية المالية.

## إعادة المحاولة + عدم التكرار

- **إعادة المحاولة**: تراجع أُسي، 3 محاولات كحد أقصى. يعيد المحاولة فقط للأخطاء العابرة (5xx، شبكة).
- **عدم التكرار**: مفاتيح UUID v4 لكل عملية إنشاء. النتائج المخزنة تُعاد للمفاتيح المكررة خلال 24 ساعة.

## تسجيل التدقيق

كل طريقة عامة تكتب في `payment_audit_log`. **لا يتم تسجيل**: أرقام البطاقات، CVV، البريد الإلكتروني، الاسم، الهاتف، العنوان.
