import { describe, it, expect, vi, beforeEach } from 'vitest';
import { resolveTranslation, wrapHtml } from '../emails/sender';

vi.mock('../i18n', () => ({
  default: {
    t: (key: string, opts?: Record<string, unknown>) => {
      const lang = opts?.lng || 'en';
      const parts = key.split('.');
      const suffix = parts[parts.length - 1];
      const interpolated = Object.entries(opts || {})
        .filter(([k]) => k !== 'lng' && k !== 'ns')
        .reduce((s, [k, v]) => s.replace(`{{${k}}}`, String(v)), `[${lang}:${key}]`);
      return interpolated;
    },
  },
}));

const LOCALES = ['en', 'ar', 'fr', 'de', 'es'] as const;

const TEMPLATE_KEYS = [
  'billing.paymentSuccess',
  'billing.paymentFailed',
  'billing.subscriptionCreated',
  'billing.renewalReminder',
  'billing.trialEnding',
  'billing.creditsLow',
] as const;

describe('Email template rendering', () => {
  describe('resolveTranslation', () => {
    for (const locale of LOCALES) {
      for (const template of TEMPLATE_KEYS) {
        it(`resolves ${template}.subject for ${locale}`, () => {
          const result = resolveTranslation(`${template}.subject`, locale, {});
          expect(result).toBeTruthy();
          expect(typeof result).toBe('string');
        });

        it(`resolves ${template}.body for ${locale}`, () => {
          const result = resolveTranslation(`${template}.body`, locale, { plan: 'Pro', amount: '$29', trialEnd: '2026-05-01' });
          expect(result).toBeTruthy();
          expect(typeof result).toBe('string');
        });
      }
    }
  });

  describe('wrapHtml', () => {
    it('wraps LTR content correctly', () => {
      const html = wrapHtml('<p>Hello</p>', 'ltr');
      expect(html).toContain('dir="ltr"');
      expect(html).toContain('<p>Hello</p>');
      expect(html).toContain('WhyNot QA');
    });

    it('wraps RTL content correctly', () => {
      const html = wrapHtml('<p>مرحبا</p>', 'rtl');
      expect(html).toContain('dir="rtl"');
      expect(html).toContain('lang="ar"');
      expect(html).toContain('<p>مرحبا</p>');
    });

    it('includes table-based layout for email clients', () => {
      const html = wrapHtml('<p>Test</p>', 'ltr');
      expect(html).toContain('max-width:600px');
      expect(html).toContain('border-radius:8px');
    });
  });

  describe('HTML snapshots per language', () => {
    for (const locale of LOCALES) {
      for (const template of TEMPLATE_KEYS) {
        it(`snapshot: ${template} in ${locale}`, () => {
          const direction = locale === 'ar' ? 'rtl' : 'ltr';
          const subject = resolveTranslation(`${template}.subject`, locale, {
            plan: 'Pro',
            amount: '$29.00',
            daysRemaining: '3',
            currentBalance: '50',
            threshold: '100',
          });
          const body = resolveTranslation(`${template}.body`, locale, {
            plan: 'Pro',
            amount: '$29.00',
            trialEnd: '2026-05-01',
            renewalDate: '2026-05-01',
            daysRemaining: '3',
            currentBalance: '50',
            threshold: '100',
          });
          const cta = resolveTranslation(`${template}.cta`, locale, {});

          const html = wrapHtml(
            `<p style="font-size:14px;line-height:1.6;">${body}</p>` +
            `<p style="text-align:center;"><a href="#" style="display:inline-block;padding:10px 24px;background:#2563eb;color:#fff;border-radius:6px;text-decoration:none;">${cta}</a></p>`,
            direction
          );

          expect(html).toMatchSnapshot();
          expect(html).toContain('<!DOCTYPE html>');
          expect(html).toContain(`dir="${direction}"`);
          expect(subject).toBeTruthy();
        });
      }
    }
  });
});

describe('Email template modules', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('exports sendPaymentSuccessEmail', async () => {
    const mod = await import('../emails/payment-success');
    expect(typeof mod.sendPaymentSuccessEmail).toBe('function');
  });

  it('exports sendPaymentFailedEmail', async () => {
    const mod = await import('../emails/payment-failed');
    expect(typeof mod.sendPaymentFailedEmail).toBe('function');
  });

  it('exports sendSubscriptionCreatedEmail', async () => {
    const mod = await import('../emails/subscription-created');
    expect(typeof mod.sendSubscriptionCreatedEmail).toBe('function');
  });

  it('exports sendSubscriptionRenewalReminderEmail', async () => {
    const mod = await import('../emails/subscription-renewal-reminder');
    expect(typeof mod.sendSubscriptionRenewalReminderEmail).toBe('function');
  });

  it('exports sendTrialEndingEmail', async () => {
    const mod = await import('../emails/trial-ending');
    expect(typeof mod.sendTrialEndingEmail).toBe('function');
  });

  it('exports sendCreditsLowEmail', async () => {
    const mod = await import('../emails/credits-low');
    expect(typeof mod.sendCreditsLowEmail).toBe('function');
  });
});
