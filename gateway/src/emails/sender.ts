import { createLogger } from '../../shared/logger/logger';
import i18n from '../i18n';

const logger = createLogger('email-sender');

export interface EmailRecipient {
  email: string;
  name?: string;
  locale?: string;
}

export interface EmailPayload {
  to: EmailRecipient;
  templateKey: string;
  data: Record<string, string>;
}

export interface EmailTransport {
  send(params: { to: string; subject: string; html: string }): Promise<void>;
}

let transport: EmailTransport | null = null;

export function setEmailTransport(t: EmailTransport): void {
  transport = t;
}

function resolveTranslation(key: string, locale: string, data: Record<string, string>): string {
  return i18n.t(key, { lng: locale, ns: 'emails', ...data }) as string;
}

function wrapHtml(body: string, direction: 'ltr' | 'rtl'): string {
  return `<!DOCTYPE html>
<html lang="${direction === 'rtl' ? 'ar' : 'en'}" dir="${direction}">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f9fafb;color:#111827;">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;padding:32px 16px;">
<tr><td>
<div style="background:#ffffff;border-radius:8px;border:1px solid #e5e7eb;padding:32px;">
${body}
</div>
<p style="text-align:center;font-size:12px;color:#6b7280;margin-top:24px;">WhyNot QA</p>
</td></tr>
</table>
</body></html>`;
}

const RTL_LOCALES = ['ar'];

export async function sendEmail(payload: EmailPayload): Promise<void> {
  const locale = payload.to.locale || 'en';
  const direction = RTL_LOCALES.includes(locale) ? 'rtl' : 'ltr';

  const subject = resolveTranslation(`${payload.templateKey}.subject`, locale, payload.data);
  const bodyText = resolveTranslation(`${payload.templateKey}.body`, locale, payload.data);
  const ctaText = resolveTranslation(`${payload.templateKey}.cta`, locale, payload.data);
  const ctaUrl = payload.data.ctaUrl || '';

  let bodyHtml = `<p style="font-size:14px;line-height:1.6;margin:0 0 16px;">${bodyText}</p>`;
  if (ctaText && ctaUrl) {
    bodyHtml += `<p style="margin:24px 0;text-align:center;">
      <a href="${ctaUrl}" style="display:inline-block;padding:10px 24px;background:#2563eb;color:#ffffff;border-radius:6px;text-decoration:none;font-size:14px;font-weight:500;">${ctaText}</a>
    </p>`;
  }

  const html = wrapHtml(bodyHtml, direction);

  if (!transport) {
    logger.warn('No email transport configured — email not sent', {
      to: payload.to.email,
      template: payload.templateKey,
    });
    return;
  }

  try {
    await transport.send({ to: payload.to.email, subject, html });
    logger.info('Email sent', { to: payload.to.email, template: payload.templateKey, locale });
  } catch (err) {
    logger.error('Failed to send email', {
      to: payload.to.email,
      template: payload.templateKey,
      error: (err as Error).message,
    });
  }
}

export { wrapHtml, resolveTranslation };
