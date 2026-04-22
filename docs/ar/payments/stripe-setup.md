---
title: "دليل إعداد Stripe"
description: "دليل شامل لتهيئة مدفوعات Stripe في منصة WhyNot QA"
lang: ar
draft: false
---

# دليل إعداد Stripe

دليل شامل لتهيئة مدفوعات Stripe في منصة WhyNot QA.

## المتطلبات الأساسية

- حساب Stripe ([stripe.com](https://stripe.com))
- تثبيت Stripe CLI ([stripe.com/docs/stripe-cli](https://stripe.com/docs/stripe-cli))
- تشغيل منصة WhyNot عبر Docker (`make start`)

## 1. إعداد لوحة تحكم Stripe

### تفعيل وضع الاختبار

1. سجّل الدخول إلى لوحة تحكم Stripe.
2. فعّل **Test mode** من الزاوية العلوية اليمنى.
3. جميع الخطوات التالية تستخدم بيانات وضع الاختبار.

### إنشاء المنتجات

أنشئ المنتجات التالية من **Products > + Add product**:

| اسم المنتج | نموذج التسعير |
|---|---|
| WhyNot Starter | متكرر (شهري + سنوي) |
| WhyNot Pro | متكرر (شهري + سنوي) |
| WhyNot Business | متكرر (شهري + سنوي) |
| WhyNot Enterprise | متكرر (شهري + سنوي) |
| PAYG | استخدام مقاس |

لكل منتج متكرر، أنشئ سعرين (شهري وسنوي). لمنتج PAYG، أنشئ سعرًا واحدًا مقاسًا.

### نسخ معرّفات الأسعار

بعد إنشاء المنتجات، انسخ كل معرّف `price_...` إلى ملف `.env`:

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

## 2. مفاتيح API

1. انتقل إلى **Developers > API keys**.
2. انسخ **Secret key** (`sk_test_...`) إلى `STRIPE_SECRET_KEY`.
3. انسخ **Publishable key** (`pk_test_...`) إلى `STRIPE_PUBLISHABLE_KEY`.

```bash
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
```

## 3. تهيئة Webhooks

### الإنتاج / بيئة التجريب

1. انتقل إلى **Developers > Webhooks > + Add endpoint**.
2. عيّن عنوان URL إلى: `https://superadmin.whynot.skrum.io/api/webhooks/stripe`
3. حدد الأحداث المراد الاستماع إليها:
   - `checkout.session.completed`
   - `invoice.paid`
   - `invoice.payment_failed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `charge.refunded`
   - `charge.dispute.created`
4. انسخ **Signing secret** (`whsec_...`) إلى `STRIPE_WEBHOOK_SECRET`.

### التطوير المحلي

استخدم Stripe CLI لتوجيه webhooks إلى بوابتك المحلية:

```bash
stripe listen --forward-to localhost:3010/api/webhooks/stripe
```

يطبع CLI سرّ توقيع webhook عند بدء التشغيل. انسخه:

```bash
STRIPE_WEBHOOK_SECRET=whsec_...  # من مخرجات stripe listen
```

أبقِ `stripe listen` قيد التشغيل في نافذة طرفية منفصلة أثناء التطوير.

## 4. ملخص متغيرات البيئة

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

## 5. أرقام بطاقات الاختبار

| رقم البطاقة | السيناريو |
|---|---|
| `4242 4242 4242 4242` | دفع ناجح |
| `4000 0000 0000 3220` | مطلوب مصادقة 3D Secure |
| `4000 0000 0000 0341` | يتم الربط بنجاح، يفشل عند الخصم |
| `4000 0000 0000 9995` | رفض لعدم كفاية الرصيد |
| `4000 0000 0000 0069` | رفض لانتهاء صلاحية البطاقة |
| `4000 0000 0000 0127` | رفض لرمز CVC غير صحيح |
| `4000 0000 0000 0002` | رفض عام |

استخدم أي تاريخ انتهاء مستقبلي (مثلاً `12/34`)، وأي رمز CVC مكوّن من 3 أرقام، وأي رمز بريدي.

## 6. اختبار التدفق الكامل

1. **تشغيل المنصة**: `make start`
2. **تشغيل مستمع Stripe**: `stripe listen --forward-to localhost:3010/api/webhooks/stripe`
3. **التسجيل** كمستخدم جديد على `http://localhost:5183`
4. **بدء الفترة التجريبية**: يُنشئ النظام اشتراكًا تجريبيًا تلقائيًا.
5. **الترقية**: انقر على "Upgrade" واستخدم بطاقة الاختبار `4242 4242 4242 4242`.
6. **التحقق**: تحقق من صف الاشتراك في قاعدة البيانات ولوحة تحكم Stripe.
7. **الإلغاء**: ألغِ من صفحة الفوترة. تحقق من `cancel_at_period_end`.
8. **إعادة التفعيل**: أعد التفعيل قبل انتهاء الفترة.
9. **اختبار الفشل**: استخدم البطاقة `4000 0000 0000 0341` لتفعيل `invoice.payment_failed`.
10. **الاسترداد**: أصدر استردادًا من واجهة المشرف.

## 7. الانتقال للإنتاج

1. أكمل قائمة تفعيل Stripe في لوحة التحكم.
2. أوقف وضع الاختبار.
3. أنشئ منتجات وأسعار الإنتاج (بنفس هيكل الاختبار).
4. حدّث `.env` بمفاتيح الإنتاج (`sk_live_...`، `pk_live_...`).
5. أنشئ نقطة نهاية webhook للإنتاج بنفس الأحداث.
6. حدّث `STRIPE_WEBHOOK_SECRET` بسرّ توقيع الإنتاج.
7. حدّث `STRIPE_SUCCESS_URL` و `STRIPE_CANCEL_URL` بعناوين URL الإنتاج.

**لا تُضمّن مفاتيح Stripe الحية في نظام التحكم بالإصدارات أبدًا.**

## 8. صفحات فوترة المشرف

توفر لوحة المشرف على `http://localhost:5184`:

- **الخطط**: إنشاء وتعديل وأرشفة ومزامنة الخطط مع Stripe.
- **الاشتراكات**: عرض جميع اشتراكات مساحات العمل مع فلاتر الحالة.
- **الأرصدة**: منح أرصدة يدوية وتصدير بيانات الأرصدة.
- **إعدادات الفوترة**: تهيئة أيام الفترة التجريبية، فترة السماح، أسعار PAYG.

يؤدي تعديل خطة في واجهة المشرف تلقائيًا إلى إنشاء أو تحديث المنتج والسعر المقابلين في Stripe عبر API.
