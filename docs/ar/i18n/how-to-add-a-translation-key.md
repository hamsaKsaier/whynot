---
title: "كيفية إضافة مفتاح ترجمة"
description: "دليل سير العمل الكامل لإضافة نص قابل للترجمة إلى WhyNot QA"
lang: ar
draft: false
---

# كيفية إضافة مفتاح ترجمة

يشرح هذا الدليل سير العمل الكامل لإضافة نص قابل للترجمة إلى WhyNot QA.

## 1. اختيار مساحة الاسم المناسبة

كل مساحة اسم تتوافق مع منطقة ميزات معينة. اختر المناسبة:

| مساحة الاسم | النطاق |
|-------------|--------|
| `common` | مسارات المصادقة، حدود الأخطاء، التسميات العامة، علامات الميزات |
| `auth` | المصادقة الثنائية |
| `dashboard` | المشاريع، البيئات، المراقبة، التكاملات، الصفحة الرئيسية |
| `runner` | منفذ الاختبار، حلقة ضمان الجودة، أدوات التنفيذ، نشاط الوكيل |
| `results` | نتائج الاختبار، حالات الاختبار، تشغيلات الاختبار، المخرجات |
| `settings` | الملف الشخصي، المؤسسة، مساحة العمل، مفاتيح API، الإشعارات، مزودو الذكاء الاصطناعي، الاستخدام، منطقة الخطر |
| `billing` | الخطط، الأرصدة، الفواتير، الدفع، الدفع حسب الاستخدام |
| `landing` | صفحات التسويق (البطل، الميزات، الأسعار، الأسئلة الشائعة، التذييل) |

**مساحات أسماء واجهة الإدارة:** `common`، `admin`، `auth`، `settings`، `superadmin`.

### شجرة قرار مساحة الاسم

1. هل النص مُستخدم في 3 ميزات أو أكثر؟ → `common`
2. هل هو نص مصادقة/تسجيل دخول/إنشاء حساب؟ → `common` (تحت بادئة `auth.*`)
3. هل هو نص مُشغّل الاختبار أو QA Loop أو التنفيذ؟ → `runner`
4. هل هو نص مشروع أو بيئة أو مراقب أو تكامل؟ → `dashboard`
5. هل هو نص نتائج اختبار أو حالة اختبار أو ملحق؟ → `results`
6. هل هو نص إعدادات/ملف شخصي/منظمة/مفتاح API؟ → `settings`
7. هل هو نص فواتير أو خطة أو رصيد أو دفع؟ → `billing`
8. هل هو نص صفحة هبوط/تسويق؟ → `landing`
9. هل هو نص مصادقة ثنائية العامل؟ → `auth`

## 2. تسمية المفتاح

تستخدم المفاتيح **camelCase مع فواصل النقاط**. الاتفاقية:

- **الأسماء** للتسميات الثابتة: `settings.profile.name`
- **الأفعال** للإجراءات: `settings.profile.save`
- **الصفات** للحالات: `runner.status.running`
- التجميع حسب الميزة: `auth.login.title`، `auth.login.emailLabel`، `auth.login.submit`

أمثلة:
```
dashboard.projects.title        -> "المشاريع"
dashboard.projects.create       -> "مشروع جديد"
dashboard.projects.empty.title  -> "لا توجد مشاريع بعد"
billing.credits.buy             -> "شراء أرصدة"
runner.controls.pause           -> "إيقاف مؤقت"
```

## 3. إضافة القيمة الإنجليزية

افتح ملف JSON المناسب تحت `frontend/public/locales/en/` (أو `admin-frontend/public/locales/en/`).

```json
{
  "dashboard.projects.title": "Projects",
  "dashboard.projects.create": "New Project",
  "dashboard.projects.empty.title": "No projects yet"
}
```

القواعد:
- المفاتيح مرتبة أبجديًا لاستقرار الفروقات.
- لا فواصل زائدة.
- ترميز UTF-8، نهايات أسطر LF.
- `landing.json` يستخدم مفاتيح متداخلة؛ جميع الملفات الأخرى تستخدم مفاتيح مسطحة.

## 4. استخدام المفتاح في مكوّن

### المكوّنات الوظيفية

```tsx
import { useTranslation } from "react-i18next"

export function ProjectsPage() {
  const { t } = useTranslation("dashboard")

  return <h1>{t("dashboard.projects.title")}</h1>
}
```

### النصوص مع عناصر مضمنة (روابط، خط عريض)

```tsx
import { Trans } from "react-i18next"

<Trans
  i18nKey="auth.signup.acceptTerms"
  ns="common"
  components={{
    termsLink: <a href="/terms" className="text-primary underline" />,
    privacyLink: <a href="/privacy" className="text-primary underline" />,
  }}
/>
```

قيمة JSON: `"أوافق على <termsLink>شروط الخدمة</termsLink> و<privacyLink>سياسة الخصوصية</privacyLink>"`

### الاستيفاء

```tsx
t("dashboard.welcome", { name: user.name })
// JSON: "مرحبًا بعودتك، {{name}}"

t("runner.progress", { current: 3, total: 10 })
// JSON: "الخطوة {{current}} من {{total}}"
```

**قواعد تسمية العناصر النائبة:**
- استخدم **camelCase** بشكل متسق: `{{userName}}`، وليس `{{user_name}}`
- اجعل الأسماء قصيرة ولكن وصفية: `{{count}}`، `{{name}}`، `{{error}}`
- استخدم نفس اسم العنصر النائب في جميع اللغات لنفس المتغير
- يجب أن يحتوي كل ملف لغة على نفس `{{العناصر النائبة}}` الموجودة في الإنجليزية بالضبط

### صيغ الجمع

يدعم i18next صيغ الجمع عبر `{{count}}`. للغات ذات قواعد جمع معقدة (مثل العربية)، استخدم اللواحق `_zero`، `_one`، `_two`، `_few`، `_many`، `_other`:

```json
// en/common.json
{
  "common.items": "{{count}} item",
  "common.items_plural": "{{count}} items"
}

// ar/common.json (العربية لديها 6 صيغ جمع)
{
  "common.items_zero": "لا عناصر",
  "common.items_one": "عنصر واحد",
  "common.items_two": "عنصران",
  "common.items_few": "{{count}} عناصر",
  "common.items_many": "{{count}} عنصرًا",
  "common.items_other": "{{count}} عنصر"
}
```

الاستخدام في المكوّنات:
```tsx
t("common.items", { count: items.length })
```

### رسائل التحقق من Zod

أنشئ المخططات داخل المكوّن أو استخدم دالة مصنع:

```tsx
function createLoginSchema(t: (key: string) => string) {
  return z.object({
    email: z.string().email(t("auth.common.emailValidation")),
    password: z.string().min(8, t("auth.common.passwordMinLength")),
  })
}

export function LoginPage() {
  const { t } = useTranslation("common")
  const loginSchema = createLoginSchema(t)
  // ...
}
```

### رسائل الإشعارات

استدعِ `t()` دائمًا وقت الاستدعاء، وليس وقت تحميل الوحدة:

```tsx
// صحيح
toast.success(t("dashboard.projects.createSuccess"))

// خطأ - t() يُستدعى وقت تحميل الوحدة، لن يُحدّث عند تغيير اللغة
const MSG = t("dashboard.projects.createSuccess")
toast.success(MSG)
```

### مكوّنات الأصناف (ErrorBoundary)

استخدم مكوّن الترتيب الأعلى `withTranslation`:

```tsx
import { withTranslation, WithTranslation } from "react-i18next"

class ErrorBoundaryInner extends React.Component<Props & WithTranslation> {
  render() {
    const { t } = this.props
    return <h1>{t("error.boundary.title")}</h1>
  }
}

export const ErrorBoundary = withTranslation("common")(ErrorBoundaryInner)
```

## 5. إضافة بذور للغات الأخرى

بعد إضافة المفاتيح الإنجليزية، زامن شجرة المفاتيح مع اللغات الأخرى:

```bash
node scripts/sync-locale-stubs.js
```

هذا يضيف قيم سلاسل فارغة لأي مفاتيح جديدة في ملفات `ar`، `fr`، `de`، `es`.

## 6. تشغيل التحقق

```bash
# فحص الأنواع
make shell-client npm run typecheck

# التدقيق
make shell-client npm run lint

# اختبارات i18n
make test-frontend

# التحقق من تخطيط RTL
make rtl-check
```

يتحقق اختبار `i18n-completeness` من:
- جميع اللغات الخمس لديها نفس ملفات مساحات الأسماء.
- جميع مساحات الأسماء لديها أشجار مفاتيح متطابقة عبر اللغات.
- جميع القيم الإنجليزية غير فارغة.
- القيم المترجمة (عند وجودها) تختلف عن الإنجليزية.

يفحص اختبار `i18n-no-hardcoded-strings` **جميع** ملفات المكوّنات والصفحات (`src/**/*.{ts,tsx}`) بحثًا عن نصوص إنجليزية ثابتة يجب أن تستخدم `t()`. يتحقق من:
- محتوى نص JSX (مثل `>نص ما<`)
- خصائص حاملة للنص: `title`، `placeholder`، `aria-label`، `alt`
- رسائل الإشعارات: `toast.error("...")`، `toast.success("...")`
- رسائل التحقق من Zod: `.min(3, "يجب أن...")`

يجب أن تبقي طلبات السحب الجديدة اختباري `i18n-completeness` و`i18n-no-hardcoded-strings` خضراء (ناجحة).

## توطين الخادم الخلفي (Backend)

واجهة برمجة التطبيقات (API) الخاصة بالبوابة (Gateway) مُوطّنة بالكامل. جميع استجابات API تحترم ترويسة `Accept-Language` المُرسلة من العميل.

### عقد `Accept-Language`

كل استجابة API تُرجع رسائل خطأ ونجاح مُوطّنة بناءً على ترويسة `Accept-Language` في الطلب. القيم المدعومة: `en`، `ar`، `fr`، `de`، `es`. إذا كانت الترويسة مفقودة أو تحتوي على لغة غير معروفة، تعود API إلى `en` كلغة افتراضية.

### كيف يعمل `req.t()`

البرمجية الوسيطة (middleware) للتوطين في `gateway/src/middleware/i18n.ts` تُحلل ترويسة `Accept-Language`، وتُهيئ مُترجمًا لكل طلب، وتُرفقه كـ `req.t()`. الاستخدام في مُعالجات المسارات:

```typescript
// بحث بسيط عن مفتاح
req.t('errors:auth.unauthorized')

// مع الاستيفاء
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

## قائمة التحقق

قبل تقديم طلب سحب مع مفاتيح ترجمة جديدة:

- [ ] المفتاح مُضاف إلى ملف JSON الصحيح لمساحة الاسم
- [ ] القيمة الإنجليزية غير فارغة ووصفية
- [ ] المكوّن يستخدم خطاف `useTranslation()` مع مساحة الاسم الصحيحة
- [ ] جميع النصوص المواجهة للمستخدم تستخدم `t()` (التسميات، العناصر النائبة، العناوين، تسميات aria، رسائل التحقق، الإشعارات)
- [ ] الاستيفاء يستخدم صيغة `{{variable}}`
- [ ] العناصر المضمنة تستخدم مكوّن `<Trans>`
- [ ] بذور اللغات مُزامنة للغات الأخرى
- [ ] اختبار `i18n-completeness` يمر بنجاح
- [ ] اختبار `i18n-no-hardcoded-strings` يمر بنجاح
