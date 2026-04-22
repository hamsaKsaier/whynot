import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockSendEmail } = vi.hoisted(() => ({
  mockSendEmail: vi.fn(),
}));
vi.mock('../../emails/sender', () => ({
  sendEmail: (...args: any[]) => mockSendEmail(...args),
}));

import { sendCreditsLowEmail } from '../../emails/credits-low';
import { sendPaymentFailedEmail } from '../../emails/payment-failed';
import { sendPaymentSuccessEmail } from '../../emails/payment-success';
import { sendSubscriptionCreatedEmail } from '../../emails/subscription-created';
import { sendSubscriptionRenewalReminderEmail } from '../../emails/subscription-renewal-reminder';
import { sendTrialEndingEmail } from '../../emails/trial-ending';

const recipient = { email: 'user@test.com', name: 'Test User', locale: 'en' };

describe('email sender functions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSendEmail.mockResolvedValue(undefined);
  });

  describe('sendCreditsLowEmail', () => {
    it('calls sendEmail with correct template and data', async () => {
      await sendCreditsLowEmail({
        recipient,
        currentBalance: '50',
        threshold: '100',
        topUpUrl: 'https://app.test/billing',
      });

      expect(mockSendEmail).toHaveBeenCalledWith({
        to: recipient,
        templateKey: 'billing.creditsLow',
        data: {
          currentBalance: '50',
          threshold: '100',
          ctaUrl: 'https://app.test/billing',
        },
      });
    });
  });

  describe('sendPaymentFailedEmail', () => {
    it('calls sendEmail with correct template and data', async () => {
      await sendPaymentFailedEmail({
        recipient,
        amount: '$29.99',
        updatePaymentUrl: 'https://app.test/payment',
      });

      expect(mockSendEmail).toHaveBeenCalledWith({
        to: recipient,
        templateKey: 'billing.paymentFailed',
        data: {
          amount: '$29.99',
          ctaUrl: 'https://app.test/payment',
        },
      });
    });
  });

  describe('sendPaymentSuccessEmail', () => {
    it('calls sendEmail with correct template and data', async () => {
      await sendPaymentSuccessEmail({
        recipient,
        amount: '$29.99',
        plan: 'Pro',
        invoiceUrl: 'https://stripe.com/invoice/123',
      });

      expect(mockSendEmail).toHaveBeenCalledWith({
        to: recipient,
        templateKey: 'billing.paymentSuccess',
        data: {
          amount: '$29.99',
          plan: 'Pro',
          ctaUrl: 'https://stripe.com/invoice/123',
        },
      });
    });

    it('uses empty string for ctaUrl when no invoiceUrl', async () => {
      await sendPaymentSuccessEmail({
        recipient,
        amount: '$10.00',
        plan: 'Starter',
      });

      expect(mockSendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ ctaUrl: '' }),
        }),
      );
    });
  });

  describe('sendSubscriptionCreatedEmail', () => {
    it('calls sendEmail with correct template and data', async () => {
      await sendSubscriptionCreatedEmail({
        recipient,
        plan: 'Pro',
        trialEnd: '2025-02-01',
        dashboardUrl: 'https://app.test/dashboard',
      });

      expect(mockSendEmail).toHaveBeenCalledWith({
        to: recipient,
        templateKey: 'billing.subscriptionCreated',
        data: {
          plan: 'Pro',
          trialEnd: '2025-02-01',
          ctaUrl: 'https://app.test/dashboard',
        },
      });
    });

    it('uses empty string for trialEnd when not provided', async () => {
      await sendSubscriptionCreatedEmail({
        recipient,
        plan: 'Free',
        dashboardUrl: 'https://app.test',
      });

      expect(mockSendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ trialEnd: '' }),
        }),
      );
    });
  });

  describe('sendSubscriptionRenewalReminderEmail', () => {
    it('calls sendEmail with correct template and data', async () => {
      await sendSubscriptionRenewalReminderEmail({
        recipient,
        plan: 'Pro',
        renewalDate: '2025-03-01',
        amount: '$29.99',
        billingUrl: 'https://app.test/billing',
      });

      expect(mockSendEmail).toHaveBeenCalledWith({
        to: recipient,
        templateKey: 'billing.renewalReminder',
        data: {
          plan: 'Pro',
          renewalDate: '2025-03-01',
          amount: '$29.99',
          ctaUrl: 'https://app.test/billing',
        },
      });
    });
  });

  describe('sendTrialEndingEmail', () => {
    it('calls sendEmail with correct template and data', async () => {
      await sendTrialEndingEmail({
        recipient,
        plan: 'Pro',
        trialEnd: '2025-02-15',
        daysRemaining: '3',
        upgradeUrl: 'https://app.test/upgrade',
      });

      expect(mockSendEmail).toHaveBeenCalledWith({
        to: recipient,
        templateKey: 'billing.trialEnding',
        data: {
          plan: 'Pro',
          trialEnd: '2025-02-15',
          daysRemaining: '3',
          ctaUrl: 'https://app.test/upgrade',
        },
      });
    });
  });
});
