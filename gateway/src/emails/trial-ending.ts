import { sendEmail, type EmailRecipient } from './sender';

export interface TrialEndingParams {
  recipient: EmailRecipient;
  plan: string;
  trialEnd: string;
  daysRemaining: string;
  upgradeUrl: string;
}

export async function sendTrialEndingEmail(params: TrialEndingParams): Promise<void> {
  await sendEmail({
    to: params.recipient,
    templateKey: 'billing.trialEnding',
    data: {
      plan: params.plan,
      trialEnd: params.trialEnd,
      daysRemaining: params.daysRemaining,
      ctaUrl: params.upgradeUrl,
    },
  });
}
