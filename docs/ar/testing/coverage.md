---
title: "سياسة تغطية الاختبارات"
description: "سياسة تغطية الاختبارات 100% لجميع حزم WhyNot QA"
lang: ar
draft: false
---

# سياسة تغطية الاختبارات

## متطلب التغطية 100%

جميع الحزم الأربع (`frontend/`، `admin-frontend/`، `gateway/`، `shared/`) تفرض **تغطية 100%** للأسطر والفروع والدوال والتعبيرات.

| المقياس | الحد الأدنى |
|---------|------------|
| الأسطر | 100% |
| الفروع | 100% |
| الدوال | 100% |
| التعبيرات | 100% |

## بوابة CI

وظيفة `unit-integration` في `.github/workflows/test.yml` تنفذ `npx vitest run --coverage` لكل حزمة. إذا انخفضت أي حزمة عن 100% في أي مقياس، تفشل الوظيفة ولا يمكن دمج طلب السحب.

يتم رفع تقارير HTML للتغطية كمرفقات بناء لكل تشغيل CI (محفوظة لمدة 14 يومًا).

## تشغيل التغطية محليًا

```bash
docker compose -f docker-compose.test.yml run --rm gateway-test npx vitest run --coverage
docker compose -f docker-compose.test.yml run --rm frontend-test npx vitest run --coverage
docker compose -f docker-compose.test.yml run --rm admin-frontend-test npx vitest run --coverage
docker compose -f docker-compose.test.yml run --rm shared-test npx vitest run --coverage
```

## المسارات المستثناة

| المسار | السبب |
|--------|-------|
| `services/qa-loop-executor/src/v2/**` | محرك للقراءة فقط |
| `services/qa-loop-executor/src/mcp-browser.ts` | تكامل MCP غير قابل للتعديل |
| `**/*.test.ts`، `**/*.test.tsx`، `**/*.spec.ts` | ملفات الاختبار |
| `**/__tests__/**` | مجلدات الاختبار |
| `**/dist/**`، `**/node_modules/**` | مخرجات البناء |
| `**/*.d.ts` | تصريحات الأنواع |
| `**/*.config.ts` | ملفات التكوين |
| `src/main.tsx` | نقطة دخول React |
| `src/server.ts` | نقطة دخول Express |
| `src/routeTree.gen.ts` | شجرة المسارات المُنشأة تلقائيًا |

## سياسة `/* istanbul ignore */`

**ممنوع** إلا إذا كان السطر غير قابل للوصول بشكل مثبت ومُشار إليه بتعليق سطر واحد يشرح السبب.

## التكوين

يتم تكوين حدود التغطية في ملف `vitest.config.ts` الخاص بكل حزمة:

```ts
coverage: {
  provider: 'v8',
  reporter: ['text', 'html', 'lcov'],
  thresholds: {
    lines: 100,
    branches: 100,
    functions: 100,
    statements: 100,
  },
  include: ['src/**'],
  exclude: [/* see excluded paths above */],
}
```
