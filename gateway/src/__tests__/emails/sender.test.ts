import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../i18n', () => ({
  default: {
    t: vi.fn((key: string, opts?: any) => {
      if (key.endsWith('.subject')) return `Subject for ${key}`;
      if (key.endsWith('.body')) return `Body for ${key}`;
      if (key.endsWith('.cta')) return opts?.ctaUrl ? `CTA for ${key}` : '';
      return key;
    }),
  },
}));

vi.mock('../../../shared/logger/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

import { sendEmail, setEmailTransport, wrapHtml, type EmailTransport } from '../../emails/sender';

describe('wrapHtml', () => {
  it('wraps body in HTML email layout (LTR)', () => {
    const html = wrapHtml('<p>Hello</p>', 'ltr');
    expect(html).toContain('dir="ltr"');
    expect(html).toContain('lang="en"');
    expect(html).toContain('<p>Hello</p>');
    expect(html).toContain('WhyNot QA');
  });

  it('wraps body with RTL direction for Arabic', () => {
    const html = wrapHtml('<p>مرحبا</p>', 'rtl');
    expect(html).toContain('dir="rtl"');
    expect(html).toContain('lang="ar"');
  });
});

describe('sendEmail', () => {
  let mockTransport: EmailTransport;

  beforeEach(() => {
    vi.clearAllMocks();
    mockTransport = { send: vi.fn().mockResolvedValue(undefined) };
    setEmailTransport(mockTransport);
  });

  it('calls transport.send with resolved subject, html, and recipient', async () => {
    await sendEmail({
      to: { email: 'user@test.com', locale: 'en' },
      templateKey: 'billing.paymentSuccess',
      data: { amount: '$10.00', ctaUrl: 'https://app.test/invoice' },
    });

    expect(mockTransport.send).toHaveBeenCalledWith({
      to: 'user@test.com',
      subject: expect.stringContaining('Subject'),
      html: expect.stringContaining('Body'),
    });
  });

  it('includes CTA button when ctaUrl is provided', async () => {
    await sendEmail({
      to: { email: 'user@test.com', locale: 'en' },
      templateKey: 'test.template',
      data: { ctaUrl: 'https://example.com/action' },
    });

    const html = (mockTransport.send as any).mock.calls[0][0].html;
    expect(html).toContain('https://example.com/action');
  });

  it('uses RTL direction for Arabic locale', async () => {
    await sendEmail({
      to: { email: 'user@test.com', locale: 'ar' },
      templateKey: 'test.template',
      data: {},
    });

    const html = (mockTransport.send as any).mock.calls[0][0].html;
    expect(html).toContain('dir="rtl"');
  });

  it('defaults to LTR for non-Arabic locales', async () => {
    await sendEmail({
      to: { email: 'user@test.com', locale: 'fr' },
      templateKey: 'test.template',
      data: {},
    });

    const html = (mockTransport.send as any).mock.calls[0][0].html;
    expect(html).toContain('dir="ltr"');
  });

  it('defaults locale to en when not specified', async () => {
    await sendEmail({
      to: { email: 'user@test.com' },
      templateKey: 'test.template',
      data: {},
    });

    const html = (mockTransport.send as any).mock.calls[0][0].html;
    expect(html).toContain('dir="ltr"');
  });

  it('does not throw when transport.send fails', async () => {
    (mockTransport.send as any).mockRejectedValue(new Error('SMTP error'));

    await expect(
      sendEmail({
        to: { email: 'user@test.com' },
        templateKey: 'test.template',
        data: {},
      }),
    ).resolves.toBeUndefined();
  });

  it('does not throw when no transport is configured', async () => {
    setEmailTransport(null as any);

    // Reset the internal transport to null
    // The sendEmail function checks if transport is null
    await expect(
      sendEmail({
        to: { email: 'user@test.com' },
        templateKey: 'test.template',
        data: {},
      }),
    ).resolves.toBeUndefined();
  });
});
