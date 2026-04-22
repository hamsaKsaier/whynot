---
title: "إدارة الأسرار"
description: "كيفية تعامل WhyNot مع قيم التكوين الحساسة عبر البيئات"
lang: ar
draft: true
---

# إدارة الأسرار

يصف هذا المستند كيفية تعامل WhyNot مع قيم التكوين الحساسة عبر البيئات.

## المبادئ

1. **لا تُودع الأسرار أبدًا** — `.env` مُتجاهل في git. فقط `.env.example` (مع قيم بديلة) يتم تتبعه.
2. **لا تُسجّل الأسرار أبدًا** — وحدة تكوين البوابة تتحقق من الأسرار عند بدء التشغيل لكنها لا تكتب قيمها في السجلات.
3. **الفشل السريع** — الأسرار المطلوبة المفقودة تسبب فشلًا فوريًا عند بدء التشغيل مع رسالة خطأ واضحة.

## التطوير

في التطوير المحلي، تُخزّن الأسرار في ملف `.env`:

```bash
cp .env.example .env
# Fill in required values:
#   JWT_SECRET          — any long random string
#   SECRETS_ENCRYPTION_KEY — openssl rand -base64 32
#   ENCRYPTION_KEY      — any random string
```

للتطوير المحلي، يمكنك استخدام قيم بديلة. ميزات OAuth وStripe لن تكون متاحة بدون بيانات اعتماد حقيقية.

## الإنتاج

في الإنتاج، يجب أن تأتي الأسرار من بيئة المضيف أو مدير أسرار — **لا تستخدم** ملف `.env` على القرص أبدًا.

### الأساليب الموصى بها

#### 1. متغيرات بيئة المضيف (الأبسط)

عيّن المتغيرات مباشرة على المضيف أو في منصة النشر:

```bash
# Example: systemd service
Environment="JWT_SECRET=<real-value>"
Environment="SECRETS_ENCRYPTION_KEY=<real-value>"

# Example: Docker run
docker run -e JWT_SECRET=<real-value> -e SECRETS_ENCRYPTION_KEY=<real-value> ...
```

#### 2. أسرار Docker (Swarm)

لعمليات نشر Docker Swarm، استخدم أسرار Docker:

```bash
echo "<real-jwt-secret>" | docker secret create jwt_secret -
```

#### 3. مديرو الأسرار السحابيون

- **AWS**: Secrets Manager أو SSM Parameter Store
- **GCP**: Secret Manager
- **Azure**: Key Vault

حقن الأسرار عند بدء الحاوية عبر آلية حقن الأسرار الأصلية لمنسّقك.

## تدوير الأسرار

### JWT_SECRET

تدوير `JWT_SECRET` يُبطل جميع جلسات المستخدمين الحالية. للتدوير بسلاسة:

1. أضف السرّ الجديد بجانب القديم (إذا كان وسيط المصادقة يدعم مفاتيح متعددة)
2. انشر مع السرّ الجديد
3. انتظر انتهاء صلاحية الرموز القديمة (الافتراضي: 7 أيام)
4. أزل السرّ القديم

### SECRETS_ENCRYPTION_KEY / ENCRYPTION_KEY

هذه تُشفّر بيانات الاعتماد المخزّنة ورموز التكامل. يتطلب التدوير إعادة تشفير جميع القيم المخزّنة:

1. أنشئ مفتاحًا جديدًا: `openssl rand -base64 32`
2. شغّل ترحيل إعادة التشفير (إذا كان متاحًا)
3. انشر مع المفتاح الجديد

### مفاتيح Stripe

يمكن تدوير مفاتيح Stripe في لوحة تحكم Stripe. حدّث متغيرات البيئة وأعد النشر.

## الأسرار المطلوبة حسب البيئة

| السرّ | التطوير | بيئة التجريب | الإنتاج |
|-------|---------|--------------|---------|
| `JWT_SECRET` | قيمة بديلة مقبولة | قيمة حقيقية | قيمة حقيقية (قوية) |
| `SECRETS_ENCRYPTION_KEY` | يمكن تخطيه (تتدهور الميزة) | قيمة حقيقية | قيمة حقيقية |
| `ENCRYPTION_KEY` | يمكن تخطيه (تتدهور الميزة) | قيمة حقيقية | قيمة حقيقية |
| `GITHUB_CLIENT_ID/SECRET` | اختياري | قيمة حقيقية | قيمة حقيقية |
| `GOOGLE_CLIENT_ID/SECRET` | اختياري | قيمة حقيقية | قيمة حقيقية |
| `STRIPE_SECRET_KEY` | اختياري | مفتاح وضع الاختبار | مفتاح وضع الإنتاج |
| `STRIPE_WEBHOOK_SECRET` | اختياري | قيمة حقيقية | قيمة حقيقية |
| `RESEND_API_KEY` | اختياري | قيمة حقيقية | قيمة حقيقية |
| `ANTHROPIC_API_KEY` | مطلوب للذكاء الاصطناعي | قيمة حقيقية | قيمة حقيقية |

## إنشاء الأسرار

```bash
# JWT secret (64 bytes, base64-encoded)
openssl rand -base64 64

# Encryption key (32 bytes, base64-encoded — required format for AES-256)
openssl rand -base64 32

# Generic random string
openssl rand -hex 32
```
