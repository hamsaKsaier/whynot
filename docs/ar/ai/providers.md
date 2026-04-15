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
import { selectAIProvider } from './utils/ai/select-ai-provider';
import { generateText } from 'ai';

const provider = selectAIProvider({
  apiUrl: 'https://api.anthropic.com',
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

const { text } = await generateText({
  model: provider('claude-sonnet-4-6'),
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

## تنبيه OpenRouter

يستخدم OpenRouter دالة `createOpenAICompatible` بدلاً من `createOpenAI`. الإصدار 6 من OpenAI SDK يستخدم Responses API افتراضيًا (نقطة النهاية `/responses`)، والتي لا يدعمها OpenRouter. يدعم OpenRouter فقط نقطة النهاية القياسية `/chat/completions`. راجع commit `e231a08` للسياق.
