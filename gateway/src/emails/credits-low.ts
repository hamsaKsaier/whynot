import { sendEmail, type EmailRecipient } from './sender';

export interface CreditsLowParams {
  recipient: EmailRecipient;
  currentBalance: string;
  threshold: string;
  topUpUrl: string;
}

export async function sendCreditsLowEmail(params: CreditsLowParams): Promise<void> {
  await sendEmail({
    to: params.recipient,
    templateKey: 'billing.creditsLow',
    data: {
      currentBalance: params.currentBalance,
      threshold: params.threshold,
      ctaUrl: params.topUpUrl,
    },
  });
}
