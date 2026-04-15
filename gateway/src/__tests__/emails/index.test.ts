import { describe, it, expect } from 'vitest';

// Re-export check — ensure all expected symbols are exported
import {
  sendEmail,
  setEmailTransport,
  sendPaymentSuccessEmail,
  sendPaymentFailedEmail,
  sendSubscriptionCreatedEmail,
  sendSubscriptionRenewalReminderEmail,
  sendTrialEndingEmail,
  sendCreditsLowEmail,
} from '../../emails/index';

describe('emails/index barrel exports', () => {
  it('exports sendEmail', () => {
    expect(typeof sendEmail).toBe('function');
  });

  it('exports setEmailTransport', () => {
    expect(typeof setEmailTransport).toBe('function');
  });

  it('exports sendPaymentSuccessEmail', () => {
    expect(typeof sendPaymentSuccessEmail).toBe('function');
  });

  it('exports sendPaymentFailedEmail', () => {
    expect(typeof sendPaymentFailedEmail).toBe('function');
  });

  it('exports sendSubscriptionCreatedEmail', () => {
    expect(typeof sendSubscriptionCreatedEmail).toBe('function');
  });

  it('exports sendSubscriptionRenewalReminderEmail', () => {
    expect(typeof sendSubscriptionRenewalReminderEmail).toBe('function');
  });

  it('exports sendTrialEndingEmail', () => {
    expect(typeof sendTrialEndingEmail).toBe('function');
  });

  it('exports sendCreditsLowEmail', () => {
    expect(typeof sendCreditsLowEmail).toBe('function');
  });
});
