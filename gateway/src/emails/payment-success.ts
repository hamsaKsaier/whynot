import { sendEmail, type EmailRecipient } from './sender';

export interface PaymentSuccessParams {
  recipient: EmailRecipient;
  amount: string;
  plan: string;
  invoiceUrl?: string;
}

export async function sendPaymentSuccessEmail(params: PaymentSuccessParams): Promise<void> {
  await sendEmail({
    to: params.recipient,
    templateKey: 'billing.paymentSuccess',
    data: {
      amount: params.amount,
      plan: params.plan,
      ctaUrl: params.invoiceUrl || '',
    },
  });
}
