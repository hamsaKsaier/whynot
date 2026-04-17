---
title: "مصفوفة مزوّدي الذكاء الاصطناعي"
description: "المزوّدون المدعومون للذكاء الاصطناعي وكيفية تكوينهم في WhyNot QA"
lang: ar
draft: false
---

# مصفوفة مزوّدي الذكاء الاصطناعي

يدعم WhyNot QA عدة مزوّدين للذكاء الاصطناعي من خلال مصنع موحّد في `gateway/src/utils/ai/select-ai-provider.ts`. جميع استدعاءات الذكاء الاصطناعي غير v2 تمر عبر هذا المصنع.

## المزوّدون المدعومون

| المزوّد | نمط الكشف | SDK | ملاحظات |
|---------|-----------|-----|---------|
| OpenAI | `api.openai.com` | `@ai-sdk/openai` | واجهة OpenAI الافتراضية |
| Anthropic | `api.anthropic.com` | `@ai-sdk/anthropic` | نماذج Claude |
| Google | `generativelanguage.googleapis.com` | `@ai-sdk/google` | نماذج Gemini |
| OpenRouter | `openrouter.ai` | `@ai-sdk/openai-compatible` | موجّه متعدد النماذج |
| مخصص | أي عنوان URL آخر | `@ai-sdk/openai-compatible` | أي نقطة نهاية متوافقة مع OpenAI |

## الاستخدام

```typescript
import { getPlatformAIModel } from './utils/ai/get-platform-ai-model';
import { generateText } from 'ai';

const model = await getPlatformAIModel();

const { text } = await generateText({
  model,
  prompt: 'مرحبا',
});
```

## كشف المزوّد

يكشف المصنع المزوّد تلقائيًا من عنوان URL. يمكنك تجاوز الكشف بتمرير حقل `provider` صريح:

```typescript
const provider = selectAIProvider({
  apiUrl: 'https://my-proxy.example.com/anthropic',
  apiKey: 'key',
  provider: 'anthropic',
});
```

## تهيئة الذكاء الاصطناعي على مستوى المنصة

يتم تخزين مفاتيح API لمزوّدي الذكاء الاصطناعي مشفّرة في جدول `platform_ai_config` في قاعدة البيانات، ويديرها المسؤولون الرئيسيون عبر لوحة الإدارة.

> **ملاحظة ترحيل:** تمت إزالة تهيئة مفاتيح API عبر `.env` (`ANTHROPIC_API_KEY`، `OPENAI_API_KEY`، إلخ) من البوابة. إذا كنت تقوم بالترقية من إصدار كان يستخدم `.env` لمفاتيح الذكاء الاصطناعي، يجب الآن تهيئة المفاتيح عبر لوحة الإدارة. مسار وكيل `services/qa-loop-executor/src/v2/` لا يزال يقرأ من متغيرات البيئة.

### واجهة API الداخلية للوصول بين الحاويات

تكشف البوابة عن `GET /api/internal/ai-config` للخدمات الداخلية (مثل qa-loop-executor) التي تعمل في حاويات Docker منفصلة. تعيد نقطة النهاية هذه مفاتيح الذكاء الاصطناعي المفكّكة وهي مقيّدة بشبكة Docker عبر قائمة السماح بعناوين IP.

### مخطط الجدول

| العمود | النوع | الوصف |
|--------|-------|-------|
| `provider` | `VARCHAR(50)` | معرّف المزوّد (`openai`، `anthropic`، `google`، `openrouter`) |
| `display_name` | `VARCHAR(100)` | اسم قابل للقراءة |
| `api_key_encrypted` | `BYTEA` | مفتاح API الأساسي مشفّر بـ AES-256-GCM |
| `fallback_key_encrypted` | `BYTEA` | مفتاح API الاحتياطي مشفّر بـ AES-256-GCM |
| `default_model` | `VARCHAR(100)` | النموذج الافتراضي لهذا المزوّد |
| `models` | `JSONB` | قائمة النماذج المتوفرة |
| `is_active` | `BOOLEAN` | نشط فقط عند تهيئة مفتاح صالح |
| `rate_limit` | `INTEGER` | الطلبات في الدقيقة (0 = غير محدود) |

### التشفير

يتم تشفير جميع مفاتيح API في حالة السكون باستخدام AES-256-GCM (نفس الخوارزمية المستخدمة لتهيئة الذكاء الاصطناعي على مستوى المستخدم). يتم تخزين كل مفتاح في ثلاثة أعمدة منفصلة: النص المشفّر، متجه التهيئة (IV)، وعلامة المصادقة. يتم تهيئة مفتاح التشفير عبر متغير البيئة `SECRETS_ENCRYPTION_KEY`.

### المزوّد الافتراضي وترتيب الاحتياط

يتم تخزين مزوّد الذكاء الاصطناعي الافتراضي وترتيب الاحتياط في جدول `billing_config`:

- `default_ai_provider` — كائن JSON يحتوي على حقلي `provider` و `model`
- `ai_fallback_order` — مصفوفة JSON لمعرّفات المزوّدين بترتيب الأولوية

## تنبيه OpenRouter

يستخدم OpenRouter دالة `createOpenAICompatible` بدلاً من `createOpenAI`. الإصدار 6 من OpenAI SDK يستخدم Responses API افتراضيًا (نقطة النهاية `/responses`)، والتي لا يدعمها OpenRouter. يدعم OpenRouter فقط نقطة النهاية القياسية `/chat/completions`. راجع commit `e231a08` للسياق.
