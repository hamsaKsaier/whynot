import { sendEmail, type EmailRecipient } from './sender';

export interface PaymentFailedParams {
  recipient: EmailRecipient;
  amount: string;
  updatePaymentUrl: string;
}

export async function sendPaymentFailedEmail(params: PaymentFailedParams): Promise<void> {
  await sendEmail({
    to: params.recipient,
    templateKey: 'billing.paymentFailed',
    data: {
      amount: params.amount,
      ctaUrl: params.updatePaymentUrl,
    },
  });
}
