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
make shell-client npm test -- i18n
```

يتحقق اختبار `i18n-completeness` من:
- جميع اللغات الخمس لديها نفس ملفات مساحات الأسماء.
- جميع مساحات الأسماء لديها أشجار مفاتيح متطابقة عبر اللغات.
- جميع القيم الإنجليزية غير فارغة.
- القيم المترجمة (عند وجودها) تختلف عن الإنجليزية.
- القيم العربية تحتوي على أحرف عربية.

يفحص اختبار `i18n-no-hardcoded-strings` ملفات الصفحات بحثًا عن نصوص إنجليزية ثابتة يجب أن تستخدم `t()`.

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
