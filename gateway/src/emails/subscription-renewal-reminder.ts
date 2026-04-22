import { sendEmail, type EmailRecipient } from './sender';

export interface SubscriptionRenewalReminderParams {
  recipient: EmailRecipient;
  plan: string;
  renewalDate: string;
  amount: string;
  billingUrl: string;
}

export async function sendSubscriptionRenewalReminderEmail(params: SubscriptionRenewalReminderParams): Promise<void> {
  await sendEmail({
    to: params.recipient,
    templateKey: 'billing.renewalReminder',
    data: {
      plan: params.plan,
      renewalDate: params.renewalDate,
      amount: params.amount,
      ctaUrl: params.billingUrl,
    },
  });
}
