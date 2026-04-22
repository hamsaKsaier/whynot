---
title: "مرجع متغيرات البيئة"
description: "المرجع الرسمي لجميع متغيرات البيئة المستخدمة في منصة WhyNot"
lang: ar
draft: true
---

# مرجع متغيرات البيئة

هذا المستند هو المرجع الرسمي لكل متغير بيئة يستخدمه منصة WhyNot.

## البدء السريع

```bash
cp .env.example .env
# Edit .env and fill in REQUIRED values
# Then: make start
```

## بنية التكوين

- **Gateway** — يتم التحقق منه عند بدء التشغيل عبر مخطط Zod في `gateway/src/config/env.ts`. المتغيرات المطلوبة المفقودة تسبب خروجًا فوريًا مع رسالة خطأ واضحة.
- **Frontend** — متغيرات وقت البناء المسبوقة بـ `VITE_` تُدمج في حزمة JS. مركزة في `frontend/src/config.ts`.
- **Admin Frontend** — نفس النمط، مركزة في `admin-frontend/src/config.ts`.
- **Services** (test-executor, qa-loop-executor) — تقرأ `process.env` مباشرة؛ Docker Compose يمرر المتغيرات عبر `environment:` أو `env_file:`.

## مرجع المتغيرات

### قاعدة البيانات

| المتغير | مطلوب | الافتراضي | يُستخدم بواسطة | الوصف |
|----------|--------|-----------|----------------|-------|
| `DATABASE_URL` | لا | _(يُبنى من POSTGRES_*)_ | gateway, services | سلسلة اتصال PostgreSQL الكاملة. تتجاوز المتغيرات الفردية. |
| `POSTGRES_USER` | لا | `whynot` | gateway, services, Docker | مستخدم قاعدة البيانات |
| `POSTGRES_PASSWORD` | لا | `whynot` | gateway, services, Docker | كلمة مرور قاعدة البيانات (**غيّرها في الإنتاج**) |
| `POSTGRES_DB` | لا | `whynot` | gateway, services, Docker | اسم قاعدة البيانات |
| `POSTGRES_HOST` | لا | `database` | gateway | اسم المضيف (اسم خدمة Docker في الحاويات) |
| `POSTGRES_PORT` | لا | `5433` | Docker | منفذ **المضيف** لـ PostgreSQL |

### المصادقة

| المتغير | مطلوب | الافتراضي | يُستخدم بواسطة | الوصف |
|----------|--------|-----------|----------------|-------|
| `JWT_SECRET` | **نعم** | — | gateway | مفتاح توقيع الرموز. أنشئه: `openssl rand -base64 64` |
| `GITHUB_CLIENT_ID` | لتسجيل دخول GitHub | — | gateway | معرّف عميل تطبيق GitHub OAuth |
| `GITHUB_CLIENT_SECRET` | لتسجيل دخول GitHub | — | gateway | سرّ عميل تطبيق GitHub OAuth |
| `GITHUB_CALLBACK_URL` | لا | `http://localhost:3010/api/auth/github/callback` | gateway | عنوان URL لاستدعاء OAuth |
| `GOOGLE_CLIENT_ID` | لتسجيل دخول Google | — | gateway | معرّف عميل Google OAuth |
| `GOOGLE_CLIENT_SECRET` | لتسجيل دخول Google | — | gateway | سرّ عميل Google OAuth |
| `GOOGLE_CALLBACK_URL` | لا | `http://localhost:3010/api/auth/google/callback` | gateway | عنوان URL لاستدعاء OAuth |

### التشفير

| المتغير | مطلوب | الافتراضي | يُستخدم بواسطة | الوصف |
|----------|--------|-----------|----------------|-------|
| `SECRETS_ENCRYPTION_KEY` | **نعم** (للأسرار) | — | gateway | مفتاح AES-256، 32 بايت بترميز base64. أنشئه: `openssl rand -base64 32` |
| `ENCRYPTION_KEY` | **نعم** (للتكاملات) | — | gateway | مفتاح تشفير رموز التكامل |

### فوترة Stripe

| المتغير | مطلوب | الافتراضي | يُستخدم بواسطة | الوصف |
|----------|--------|-----------|----------------|-------|
| `STRIPE_SECRET_KEY` | للمدفوعات | — | gateway | مفتاح Stripe API السرّي |
| `STRIPE_PUBLISHABLE_KEY` | للمدفوعات | — | gateway | مفتاح Stripe القابل للنشر |
| `STRIPE_WEBHOOK_SECRET` | للمدفوعات | — | gateway | سرّ توقيع webhook من Stripe |
| `STRIPE_SUCCESS_URL` | لا | `http://localhost:5183/billing?success=true` | gateway | إعادة التوجيه بعد نجاح الدفع |
| `STRIPE_CANCEL_URL` | لا | `http://localhost:5183/billing?canceled=true` | gateway | إعادة التوجيه بعد إلغاء الدفع |
| `STRIPE_PRICE_*` | لا | — | gateway | معرّفات أسعار Stripe لكل مستوى خطة |

### مزوّدو الذكاء الاصطناعي

| المتغير | مطلوب | الافتراضي | يُستخدم بواسطة | الوصف |
|----------|--------|-----------|----------------|-------|
| `LLM_PROVIDER` | لا | `anthropic` | ai-service | مزوّد الذكاء الاصطناعي: `anthropic` أو `openai` |
| `ANTHROPIC_API_KEY` | إذا كان المزوّد=anthropic | — | gateway, ai-service | مفتاح API لـ Anthropic |
| `ANTHROPIC_MODEL` | لا | `claude-sonnet-4-6` | ai-service | معرّف نموذج Anthropic |
| `OPENAI_API_KEY` | إذا كان المزوّد=openai | — | ai-service | مفتاح API لـ OpenAI |
| `OPENAI_MODEL` | لا | `gpt-4` | ai-service | معرّف نموذج OpenAI |
| `OPENAI_VISION_MODEL` | لا | `gpt-4o` | ai-service | نموذج الرؤية من OpenAI |

### البريد الإلكتروني

| المتغير | مطلوب | الافتراضي | يُستخدم بواسطة | الوصف |
|----------|--------|-----------|----------------|-------|
| `RESEND_API_KEY` | لا | — | gateway | مفتاح API لـ Resend.com. إذا لم يُعيّن، يتم تخطي الرسائل بصمت. |
| `EMAIL_FROM_ADDRESS` | لا | `WhyNot <notifications@whynot.qa>` | gateway | عنوان المُرسل للرسائل التشغيلية |

### حدود المعدل

| المتغير | مطلوب | الافتراضي | يُستخدم بواسطة | الوصف |
|----------|--------|-----------|----------------|-------|
| `RATE_LIMIT_MAX_REQUESTS` | لا | `100` | gateway | حد API العام لكل 15 دقيقة |
| `RATE_LIMIT_TEST_EXECUTION_MAX` | لا | `10` | gateway | حد تنفيذ الاختبارات لكل ساعة |
| `RATE_LIMIT_TEST_GENERATION_MAX` | لا | `20` | gateway | حد إنشاء الاختبارات لكل 15 دقيقة |
| `RATE_LIMIT_QA_LOOP_MAX` | لا | `5` | gateway | جلسات QA loop لكل ساعة |
| `RATE_LIMIT_LOGIN_MAX` | لا | `10` | gateway | محاولات تسجيل الدخول لكل 15 دقيقة |
| `RATE_LIMIT_REGISTER_MAX` | لا | `5` | gateway | التسجيلات لكل ساعة |
| `RATE_LIMIT_PUBLIC_MAX` | لا | `10` | gateway | نقاط النهاية العامة لكل 15 دقيقة |

### عناوين URL

| المتغير | مطلوب | الافتراضي | يُستخدم بواسطة | الوصف |
|----------|--------|-----------|----------------|-------|
| `FRONTEND_URL` | لا | `http://localhost:5183` | gateway | عنوان URL للواجهة الأمامية الرئيسية |
| `ADMIN_FRONTEND_URL` | لا | `http://localhost:5184` | gateway | عنوان URL لواجهة الإدارة |
| `CORS_ALLOWED_ORIGINS` | لا | — | gateway | أصول CORS إضافية (مفصولة بفواصل) |

### متغيرات وقت البناء للواجهة الأمامية (VITE_*)

| المتغير | مطلوب | الافتراضي | يُستخدم بواسطة | الوصف |
|----------|--------|-----------|----------------|-------|
| `VITE_API_URL` | لا | `/api` | frontend, admin-frontend | عنوان URL لـ API الخلفية |
| `VITE_WS_URL` | لا | `ws://localhost:3011` | frontend | عنوان URL لـ WebSocket لمنفذ الاختبارات |
| `VITE_QA_LOOP_WS_URL` | لا | `ws://localhost:3012` | frontend | عنوان URL لـ WebSocket لحلقة QA |
| `VITE_APP_VERSION` | لا | `2.0.0` | frontend | الإصدار المعروض في التذييل |

### منافذ المضيف (Docker)

| المتغير | الافتراضي | الوصف |
|----------|-----------|-------|
| `POSTGRES_PORT` | `5433` | منفذ المضيف لـ PostgreSQL |
| `AI_SERVICE_PORT` | `8010` | منفذ المضيف لخدمة الذكاء الاصطناعي |
| `GATEWAY_PORT` | `3010` | منفذ المضيف للبوابة |
| `TEST_EXECUTOR_PORT` | `3011` | منفذ المضيف لمنفذ الاختبارات |
| `QA_LOOP_EXECUTOR_PORT` | `3012` | منفذ المضيف لمنفذ حلقة QA |
| `FRONTEND_PORT` | `5183` | منفذ المضيف للواجهة الأمامية |
| `ADMIN_FRONTEND_PORT` | `5184` | منفذ المضيف لواجهة الإدارة |

### المراقبة

| المتغير | مطلوب | الافتراضي | يُستخدم بواسطة | الوصف |
|----------|--------|-----------|----------------|-------|
| `LOG_LEVEL` | لا | `info` | all services | `debug`، `info`، `warn`، أو `error` |

## التحقق في CI

شغّل فحص المزامنة للتأكد من تطابق `.env.example` مع قاعدة الشفرة:

```bash
./scripts/check-env-sync.sh
```

يتحقق هذا السكريبت من:
1. عدم وجود إدخالات ميتة في `.env.example` (معرّفة لكن غير مستخدمة)
2. عدم وجود قراءات مباشرة لـ `process.env` في البوابة خارج `config/env.ts`
3. عدم وجود قراءات مباشرة لـ `import.meta.env` في الواجهات الأمامية خارج `config.ts`
