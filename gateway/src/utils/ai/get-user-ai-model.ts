import { UserAiConfigRepository } from '../../../shared/database/repositories/user-ai-config-repository';
import { SubscriptionRepository } from '../../../shared/database/repositories/subscription-repository';
import { PlanRepository } from '../../../shared/database/repositories/plan-repository';
import { decrypt } from '../crypto/secret-cipher';
import { selectAIProvider } from './select-ai-provider';
import { providerBaseUrl } from './provider-base-url';
import { getPlatformAIModel } from './get-platform-ai-model';
import { PLANS } from '../../../shared/constants/pricing';
import type { AIProviderName } from './detect-provider';

const repo = new UserAiConfigRepository();
const subscriptionRepo = new SubscriptionRepository();
const planRepo = new PlanRepository();

export async function getUserAIModel(userId: string, workspaceId?: string) {
  const config = await repo.findDefault(userId);

  if (config) {
    const apiKey = decrypt({
      ciphertext: config.api_key_encrypted,
      iv: config.api_key_iv,
      tag: config.api_key_tag,
    });

    const apiUrl = config.base_url || providerBaseUrl(config.provider as AIProviderName);

    const provider = selectAIProvider({
      apiUrl,
      apiKey,
      provider: config.provider as AIProviderName,
    });

    return provider(config.model);
  }

  if (workspaceId) {
    const subscription = await subscriptionRepo.findByWorkspaceId(workspaceId);
    const plan = subscription ? await planRepo.findBySlug(subscription.plan_id) : null;
    if (!plan) {
      const planById = subscription ? await planRepo.findById(subscription.plan_id) : null;
      if (planById && PLANS[planById.slug as keyof typeof PLANS]?.tier === 'managed_payg') {
        return getPlatformAIModel();
      }
    } else if (PLANS[plan.slug as keyof typeof PLANS]?.tier === 'managed_payg') {
      return getPlatformAIModel();
    }
  }

  return null;
}
