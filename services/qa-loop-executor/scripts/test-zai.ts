/**
 * Smoke test for Z.ai GLM provider via the AI SDK.
 *
 * Run with:
 *   Z_AI_API_KEY=sk-xxxxx npx tsx scripts/test-zai.ts
 *
 * Optional env vars:
 *   Z_AI_MODEL=glm-5.1          (override the model name)
 *   Z_AI_BASE_URL=https://api.z.ai/api/paas/v4/
 *
 * Verifies that the provider is wired up correctly and that the model
 * responds with valid text + token usage before deploying to Railway.
 */
import { generateText } from 'ai';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';

async function main() {
  if (!process.env.Z_AI_API_KEY) {
    console.error('ERROR: Z_AI_API_KEY environment variable not set.');
    console.error('Usage: Z_AI_API_KEY=sk-xxxxx npx tsx scripts/test-zai.ts');
    process.exit(1);
  }

  const baseURL = process.env.Z_AI_BASE_URL || 'https://api.z.ai/api/paas/v4/';
  const modelName = process.env.Z_AI_MODEL || 'glm-5.1';

  console.log(`Testing Z.ai provider`);
  console.log(`  baseURL: ${baseURL}`);
  console.log(`  model:   ${modelName}`);
  console.log('');

  const zai = createOpenAICompatible({
    name: 'z-ai',
    apiKey: process.env.Z_AI_API_KEY,
    baseURL,
  });

  try {
    const result = await generateText({
      model: zai(modelName),
      prompt: 'You are a QA engineer. In one sentence, what is the most common security issue in login forms?',
      maxOutputTokens: 200,
    });

    console.log('✅ Response received:');
    console.log(result.text);
    console.log('');
    console.log('Token usage:', result.usage);
  } catch (err: any) {
    console.error('❌ Z.ai API call failed:');
    console.error(`  Message: ${err.message}`);
    if (err.statusCode) console.error(`  Status:  ${err.statusCode}`);
    if (err.responseBody) console.error(`  Body:    ${err.responseBody}`);
    console.error('');
    console.error('Common fixes:');
    console.error('  - Verify the base URL (try https://api.z.ai/api/paas/v4/ or https://open.bigmodel.cn/api/paas/v4/)');
    console.error('  - Verify the model name (glm-5.1 vs glm-4.6-flash etc.)');
    console.error('  - Check the API key is valid (dashboard: https://z.ai/)');
    process.exit(1);
  }
}

main();
