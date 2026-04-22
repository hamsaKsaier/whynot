---
title: "اختبار الأداء"
description: "اختبار الأداء المدمج مع دعم التعريب في WhyNot QA"
lang: ar
draft: false
---

# اختبار الأداء

## نظرة عامة

يتضمن WhyNot QA اختبار أداء مدمج مع دعم لأنواع اختبارات الدخان، والحمل، والإجهاد، والذروة. تُعرض النتائج في الوقت الفعلي مع رسوم بيانية، ومقاييس، وحكم سردي.

## التعريب

جميع نصوص واجهة اختبار الأداء معرّبة بالكامل عبر اللغات الخمس المدعومة (الإنجليزية، العربية، الفرنسية، الألمانية، الإسبانية).

### نص الحكم

يتم إنشاء السرد التقييمي (الملخص المعروض بعد اكتمال الاختبار) من جانب العميل باستخدام استيفاء `react-i18next`. تقع مفاتيح الترجمة في `frontend/public/locales/{lang}/runner.json` تحت مساحة الاسم `runner.performance.verdict.*`.

كل فرع حكم يقبل قيمًا ديناميكية:

| المفتاح | متغيرات الاستيفاء |
|---------|-------------------|
| `verdict.okLatency` | `{{rps}}`، `{{avgMs}}` |
| `verdict.highErrorRate` | `{{errorPct}}` |
| `verdict.moderateErrorRate` | `{{errorPct}}` |
| `verdict.slowP95` | `{{seconds}}` |
| `verdict.moderateP95` | `{{ms}}` |
| `verdict.spikyP99` | `{{ms}}` |
| `verdict.goodAvg` | `{{avgMs}}` |
| `verdict.successRate` | `{{totalRequests}}`، `{{successPct}}` |

### تسميات الرسوم البيانية

تستخدم تلميحات الرسوم البيانية ووسائل الإيضاح مفاتيح تحت `runner.performance.chart.*`:
- `chart.unit.ms` — وحدة الميلي ثانية
- `chart.unit.rps` — وحدة الطلبات في الثانية
- `chart.unit.vus` — وحدة المستخدمين الافتراضيين
- `chart.legend.p50`، `chart.legend.p95`، `chart.legend.p99` — تسميات وسائل إيضاح المئويات

### تسميات أنواع الاختبارات

تستخدم أزرار وأوصاف أنواع الاختبارات مفاتيح `runner.performance.testType.*` و `runner.performance.testTypeDescription.*`.

### تنسيق التاريخ

يتم تنسيق التواريخ باستخدام `toLocaleString(i18n.language)` لاحترام اللغة النشطة.
