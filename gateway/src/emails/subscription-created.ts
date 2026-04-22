import { sendEmail, type EmailRecipient } from './sender';

export interface SubscriptionCreatedParams {
  recipient: EmailRecipient;
  plan: string;
  trialEnd?: string;
  dashboardUrl: string;
}

export async function sendSubscriptionCreatedEmail(params: SubscriptionCreatedParams): Promise<void> {
  await sendEmail({
    to: params.recipient,
    templateKey: 'billing.subscriptionCreated',
    data: {
      plan: params.plan,
      trialEnd: params.trialEnd || '',
      ctaUrl: params.dashboardUrl,
    },
  });
}
