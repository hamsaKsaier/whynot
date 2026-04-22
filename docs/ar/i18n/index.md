---
title: "التدويل (i18n)"
description: "نظرة عامة على دعم التدويل في WhyNot QA عبر 5 لغات"
lang: ar
draft: true
---

# التدويل (i18n)

يدعم WhyNot QA 5 لغات: الإنجليزية، العربية، الفرنسية، الألمانية، والإسبانية.

## البنية

- **المكتبة:** [react-i18next](https://react.i18next.com/) v15 + i18next v23
- **الخلفية:** `i18next-http-backend` يحمّل الترجمات من `/locales/{lang}/{namespace}.json`
- **الكشف:** `i18next-browser-languagedetector` يتحقق من localStorage > المتصفح > سمة lang في HTML
- **RTL:** العربية تُعيّن `dir="rtl"` على `<html>` عبر LanguageSwitcher
- **الاحتياط:** الإنجليزية (`en`) هي لغة الاحتياط

## ملفات اللغة

```
frontend/public/locales/
  en/    ar/    fr/    de/    es/
    common.json
    auth.json
    dashboard.json
    runner.json
    results.json
    settings.json
    billing.json
    landing.json

admin-frontend/public/locales/
  en/    ar/    fr/    de/    es/
    common.json
    admin.json
    auth.json
    settings.json
    superadmin.json
```

## الأدلة

- [كيفية إضافة مفتاح ترجمة](./how-to-add-a-translation-key.md)

## إضافة مفاتيح جديدة إلى مساحة اسم Runner

تحتوي مساحة الاسم `runner` على جميع نصوص واجهة منفذ الاختبار، بما في ذلك نص حكم الأداء. عند إضافة مفاتيح جديدة، اتبع نمط الاستيفاء المستخدم في مفاتيح الحكم كمثال:

```json
{
  "runner.performance.verdict.okLatency": "Handled {{rps}} req/s with an average latency of {{avgMs}} ms.",
  "runner.performance.verdict.highErrorRate": "{{errorPct}}% of requests failed."
}
```

راجع [توطين اختبار الأداء](../testing/performance.md) للاطلاع على القائمة الكاملة لمفاتيح الحكم ومتغيرات الاستيفاء.

## توطين الخادم الخلفي

واجهة برمجة التطبيقات (API) الخاصة بالبوابة مُوطّنة بالكامل. جميع استجابات API تحترم ترويسة `Accept-Language` المُرسلة من العميل.

### عقد `Accept-Language`

كل استجابة API تُرجع رسائل خطأ ونجاح مُوطّنة بناءً على ترويسة `Accept-Language` في الطلب. القيم المدعومة: `en`، `ar`، `fr`، `de`، `es`. إذا كانت الترويسة مفقودة أو تحتوي على لغة غير معروفة، تعود API إلى `en` كلغة افتراضية.

### كيف يعمل `req.t()`

البرمجية الوسيطة (middleware) للتوطين في `gateway/src/middleware/i18n.ts` تُحلل ترويسة `Accept-Language`، وتُهيئ مُترجمًا لكل طلب، وتُرفقه كـ `req.t()`. الاستخدام في مُعالجات المسارات:

```typescript
// Simple key lookup
req.t('errors:auth.unauthorized')

// With interpolation
req.t('success:admin.planUpdated', { planName })
```

### أين توجد ترجمات الخادم الخلفي

```
gateway/src/i18n/translations/
  en/    ar/    fr/    de/    es/
    errors.json
    success.json
    validation.json
    emails.json
    billing.json
```

كل مجلد فرعي يعكس نفس ملفات مساحات الأسماء. كل مفتاح في `en/` يجب أن يكون موجودًا في جميع مجلدات اللغات الأخرى.

### إضافة مفتاح خطأ أو نجاح جديد

1. أضف المفتاح إلى `en/{namespace}.json` (مثلاً `en/errors.json`).
2. أضف الترجمة المقابلة إلى ملفات `ar/`، `fr/`، `de/`، و`es/` لنفس مساحة الاسم.
3. استخدم `req.t('namespace:key')` في مُعالج المسار:
   ```typescript
   res.status(403).json({
     error: { code: 'auth.forbidden', message: req.t('errors:auth.forbidden') }
   });
   ```
4. للدوال المساعدة التي لا تملك وصولاً إلى `req`، استخدم `createError` مع مفتاح i18n:
   ```typescript
   createError(msg, code, status, details, 'errors:auth.forbidden')
   ```
5. شغّل اختبار `i18n-backend-completeness.test.ts` للتحقق من أن جميع اللغات تحتوي على المفتاح الجديد.

### توطين قوالب البريد الإلكتروني

تستخدم قوالب البريد الإلكتروني `i18n.getFixedT(recipientLocale, 'emails')` لترجمة المحتوى. اللغة تأتي من تفضيل اللغة المُخزّن للمستخدم (سجل المستخدم)، وليس من ترويسة `Accept-Language` في الطلب. هذا يضمن أن المستخدمين يتلقون رسائل البريد الإلكتروني بلغتهم المفضلة بغض النظر عن العميل الذي أطلق الإجراء.

### شكل استجابة الخطأ

أخطاء API تتبع أحد شكلين:

```json
{
  "error": {
    "code": "auth.invalidCredentials",
    "message": "<نص مُوطّن>"
  }
}
```

أو:

```json
{
  "success": false,
  "error": "<نص مُوطّن>"
}
```

قيمة `message` / `error` تكون دائمًا مُوطّنة بناءً على ترويسة `Accept-Language` في الطلب (أو لغة المستخدم المُخزّنة في حالة رسائل البريد الإلكتروني).

## الاختبار

- `i18n-completeness.test.ts` يتحقق من اتساق شجرة المفاتيح عبر جميع اللغات
- `i18n-no-hardcoded-strings.test.ts` يفحص النصوص الإنجليزية الثابتة غير المترجمة في مكونات الصفحات
- `i18n.test.ts` يتحقق من تكوين i18n (اللغات، RTL، البيانات الوصفية)

## التكوين

- الواجهة الأمامية: `frontend/src/i18n.ts`
- واجهة الإدارة: `admin-frontend/src/i18n.ts`
- مبدّل اللغة: `frontend/src/components/LanguageSwitcher.tsx`

## اختبار تغطية i18n

### إضافة صفحة جديدة إلى قائمة الصفحات

يجب تسجيل كل صفحة مواجهة للمستخدم في `pages-manifest.ts`:

- **الواجهة الأمامية:** `frontend/src/__tests__/pages-manifest.ts`
- **واجهة الإدارة:** `admin-frontend/src/__tests__/pages-manifest.ts`

أضف إدخالاً يحتوي على `key` و`path` و`routePattern` و`component` و`requiresAuth`. تقوم مجموعة اختبارات `pages-i18n.test.tsx` بالتكرار على هذه القائمة × 5 لغات.

### كيف يعمل ماسح التسرب الإنجليزي

بالنسبة للغات غير الإنجليزية، يفحص الاختبار `document.body.innerText` بحثًا عن تسلسلات ASCII-Latin المكونة من 4 أحرف أو أكثر (`/\b[A-Za-z]{4,}\b/`). أي تطابق غير موجود في قائمة العلامات التجارية المشتركة (`shared/constants/brand-allowlist.ts`) يُعلَّم كنص محتمل غير مترجم.

بالنسبة للعربية تحديدًا، يتحقق الاختبار أيضًا من وجود حرف عربي واحد على الأقل (`[\u0600-\u06FF]`) في المخرجات المعروضة.

### إضافة موجّه بوابة جديد إلى اختبار التكامل

عدّل الملف `gateway/src/__tests__/api/i18n-integration.test.ts`:

1. أضف مسارات اختبار تستخدم `req.t()` مع مفاتيح الترجمة المعنية.
2. أضف حالات اختبار في كتلة describe لكل لغة.
3. أضف اختبارات احتياطية (ترويسة `Accept-Language` غير معروفة أو مفقودة).

### تصحيح أخطاء اختبار صفحة-لغة فاشل

1. شغّل الاختبار المحدد: `make shell-frontend npx vitest run --reporter=verbose src/__tests__/pages-i18n.test.tsx`
2. تحقق من رسالة الخطأ — تسرد الكلمات اللاتينية غير المترجمة التي تم العثور عليها.
3. إذا كانت الكلمة اسم علامة تجارية أو كلمة مشتركة مشروعة، أضفها إلى `shared/constants/brand-allowlist.ts`.
4. إذا كانت الكلمة نص واجهة مستخدم غير مترجم، أضف مفتاح الترجمة المفقود إلى ملف JSON الخاص باللغة.
5. إذا فشلت الصفحة في العرض، تحقق من أن جميع تبعياتها مُحاكاة (mocked) في `pages-i18n.test.tsx`.

### تشغيل الاختبارات

```bash
make test                 # all packages
make test-frontend        # frontend only
make test-admin           # admin-frontend only
make test-backend         # gateway only
```
