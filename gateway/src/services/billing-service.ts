import { PlanRepository, PlanEntity } from '../../shared/database/repositories/plan-repository';
import { SubscriptionRepository, WorkspaceSubscriptionEntity } from '../../shared/database/repositories/subscription-repository';
import { CreditRepository, CreditBalanceEntity, CreditTransactionEntity } from '../../shared/database/repositories/credit-repository';
import { createError } from '../middleware/error-handler';

const planRepository = new PlanRepository();
const subscriptionRepository = new SubscriptionRepository();
const creditRepository = new CreditRepository();

export class BillingService {
  /**
   * Provision subscription + credits for a new workspace (called on registration).
   */
  async provisionNewWorkspace(workspaceId: string, planSlug: string = 'free-trial'): Promise<void> {
    const plan = await planRepository.findBySlug(planSlug);
    if (!plan) return;

    const now = new Date();
    const periodEnd = plan.trial_days > 0
      ? new Date(now.getTime() + plan.trial_days * 24 * 60 * 60 * 1000)
      : new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days default

    await subscriptionRepository.create({
      workspace_id: workspaceId,
      plan_id: plan.id,
      status: plan.trial_days > 0 ? 'trialing' : 'active',
      current_period_start: now,
      current_period_end: periodEnd,
      trial_start: plan.trial_days > 0 ? now : undefined,
      trial_end: plan.trial_days > 0 ? periodEnd : undefined,
    });

    await creditRepository.initBalance(workspaceId);

    if (plan.credits_per_period > 0) {
      await creditRepository.addCredits({
        workspace_id: workspaceId,
        amount: plan.credits_per_period,
        type: 'subscription_refill',
        description: `Initial ${plan.name} credits`,
      });
    }
  }

  /**
   * Refill credits for a billing period (called on invoice.paid webhook).
   */
  async refillCredits(workspaceId: string): Promise<CreditTransactionEntity | null> {
    const subscription = await subscriptionRepository.findByWorkspaceId(workspaceId);
    if (!subscription) return null;

    const plan = await planRepository.findById(subscription.plan_id);
    if (!plan || plan.credits_per_period <= 0) return null;

    return creditRepository.addCredits({
      workspace_id: workspaceId,
      amount: plan.credits_per_period,
      type: 'subscription_refill',
      description: `Monthly ${plan.name} credit refill`,
    });
  }

  /**
   * Change workspace plan (upgrade/downgrade).
   */
  async changePlan(workspaceId: string, newPlanId: string): Promise<WorkspaceSubscriptionEntity | null> {
    const subscription = await subscriptionRepository.findByWorkspaceId(workspaceId);
    if (!subscription) {
      throw createError('No subscription found', 404, 'NO_SUBSCRIPTION');
    }

    const newPlan = await planRepository.findById(newPlanId);
    if (!newPlan) {
      throw createError('Plan not found', 404, 'PLAN_NOT_FOUND');
    }

    const now = new Date();
    const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    return subscriptionRepository.update(subscription.id, {
      plan_id: newPlanId,
      status: 'active',
      current_period_start: now,
      current_period_end: periodEnd,
    });
  }

  /**
   * Check if workspace has enough credits for an operation.
   */
  async checkCreditBalance(workspaceId: string, requiredCredits: number): Promise<{
    hasEnough: boolean;
    balance: number;
    required: number;
  }> {
    const balanceEntity = await creditRepository.getBalance(workspaceId);
    const balance = balanceEntity?.balance || 0;
    return {
      hasEnough: balance >= requiredCredits,
      balance,
      required: requiredCredits,
    };
  }

  /**
   * Consume credits for an operation (post-operation deduction).
   */
  async consumeCredits(
    workspaceId: string,
    amount: number,
    description: string,
    referenceType?: string,
    referenceId?: string
  ): Promise<CreditTransactionEntity> {
    return creditRepository.deductCredits({
      workspace_id: workspaceId,
      amount,
      type: 'usage',
      description,
      reference_type: referenceType,
      reference_id: referenceId,
    });
  }

  /**
   * Admin: grant credits to a workspace.
   */
  async grantCredits(
    workspaceId: string,
    amount: number,
    description: string,
    performedBy: string
  ): Promise<CreditTransactionEntity> {
    return creditRepository.addCredits({
      workspace_id: workspaceId,
      amount,
      type: 'admin_grant',
      description,
      performed_by: performedBy,
    });
  }

  /**
   * Admin: revoke credits from a workspace.
   */
  async revokeCredits(
    workspaceId: string,
    amount: number,
    description: string,
    performedBy: string
  ): Promise<CreditTransactionEntity> {
    return creditRepository.deductCredits({
      workspace_id: workspaceId,
      amount,
      type: 'admin_revoke',
      description,
      reference_type: 'admin_action',
      reference_id: performedBy,
    });
  }

  /**
   * Get workspace subscription with plan details.
   */
  async getWorkspaceSubscription(workspaceId: string): Promise<{
    subscription: WorkspaceSubscriptionEntity;
    plan: PlanEntity;
    features: Record<string, string>;
  } | null> {
    const subscription = await subscriptionRepository.findByWorkspaceId(workspaceId);
    if (!subscription) return null;

    const plan = await planRepository.findById(subscription.plan_id);
    if (!plan) return null;

    const featureEntities = await planRepository.getFeatures(plan.id);
    const features: Record<string, string> = {};
    for (const f of featureEntities) {
      features[f.feature_key] = f.feature_value;
    }

    return { subscription, plan, features };
  }

  /**
   * Get usage summary for workspace in current period.
   */
  async getUsageSummary(workspaceId: string): Promise<{
    credits_used: number;
    credits_remaining: number;
    credits_total: number;
    period_start: Date | null;
    period_end: Date | null;
  }> {
    const subscription = await subscriptionRepository.findByWorkspaceId(workspaceId);
    const balance = await creditRepository.getBalance(workspaceId);

    const periodStart = subscription?.current_period_start || null;
    const periodEnd = subscription?.current_period_end || null;

    let creditsUsed = 0;
    if (periodStart && periodEnd) {
      creditsUsed = await creditRepository.getTotalUsageForPeriod(
        workspaceId,
        periodStart,
        periodEnd
      );
    }

    const plan = subscription ? await planRepository.findById(subscription.plan_id) : null;

    return {
      credits_used: creditsUsed,
      credits_remaining: balance?.balance || 0,
      credits_total: plan?.credits_per_period || 0,
      period_start: periodStart,
      period_end: periodEnd,
    };
  }
}
