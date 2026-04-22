import type { PaymentProvider } from './types';

export type PaymentServiceErrorCode =
  | 'CARD_DECLINED'
  | 'INSUFFICIENT_FUNDS'
  | 'EXPIRED_CARD'
  | 'PROVIDER_ERROR'
  | 'NETWORK_ERROR'
  | 'INVALID_REQUEST'
  | 'AUTHENTICATION_REQUIRED';

const RETRYABLE_CODES: Set<PaymentServiceErrorCode> = new Set([
  'PROVIDER_ERROR',
  'NETWORK_ERROR',
]);

export class PaymentServiceError extends Error {
  public readonly code: PaymentServiceErrorCode;
  public readonly provider: PaymentProvider;
  public readonly retryable: boolean;
  public readonly providerCode?: string;
  public readonly statusCode?: number;

  constructor(params: {
    code: PaymentServiceErrorCode;
    message: string;
    provider: PaymentProvider;
    retryable?: boolean;
    providerCode?: string;
    statusCode?: number;
    cause?: Error;
  }) {
    super(params.message);
    this.name = 'PaymentServiceError';
    this.code = params.code;
    this.provider = params.provider;
    this.retryable = params.retryable ?? RETRYABLE_CODES.has(params.code);
    this.providerCode = params.providerCode;
    this.statusCode = params.statusCode;
  }

  static fromStripeError(error: unknown): PaymentServiceError {
    if (error instanceof PaymentServiceError) return error;

    const stripeErr = error as {
      type?: string;
      code?: string;
      statusCode?: number;
      message?: string;
      decline_code?: string;
    };

    if (stripeErr.type === 'StripeCardError') {
      const code = stripeErr.decline_code === 'insufficient_funds'
        ? 'INSUFFICIENT_FUNDS' as const
        : stripeErr.code === 'expired_card'
          ? 'EXPIRED_CARD' as const
          : 'CARD_DECLINED' as const;
      return new PaymentServiceError({
        code,
        message: stripeErr.message ?? 'Card error',
        provider: 'stripe',
        retryable: false,
        providerCode: stripeErr.code,
        statusCode: stripeErr.statusCode,
        cause: error instanceof Error ? error : undefined,
      });
    }

    if (stripeErr.type === 'StripeAuthenticationError') {
      return new PaymentServiceError({
        code: 'AUTHENTICATION_REQUIRED',
        message: stripeErr.message ?? 'Authentication required',
        provider: 'stripe',
        retryable: false,
        providerCode: stripeErr.code,
        statusCode: 401,
        cause: error instanceof Error ? error : undefined,
      });
    }

    if (stripeErr.type === 'StripeInvalidRequestError') {
      return new PaymentServiceError({
        code: 'INVALID_REQUEST',
        message: stripeErr.message ?? 'Invalid request',
        provider: 'stripe',
        retryable: false,
        providerCode: stripeErr.code,
        statusCode: stripeErr.statusCode ?? 400,
        cause: error instanceof Error ? error : undefined,
      });
    }

    const isNetwork = error instanceof Error && (
      error.message.includes('ECONNREFUSED') ||
      error.message.includes('ETIMEDOUT') ||
      error.message.includes('ENOTFOUND') ||
      error.message.includes('fetch failed')
    );

    const isServerError = stripeErr.statusCode != null && stripeErr.statusCode >= 500;

    return new PaymentServiceError({
      code: isNetwork ? 'NETWORK_ERROR' : isServerError ? 'PROVIDER_ERROR' : 'PROVIDER_ERROR',
      message: error instanceof Error ? error.message : 'Unknown payment error',
      provider: 'stripe',
      retryable: isNetwork || isServerError,
      providerCode: stripeErr.code,
      statusCode: stripeErr.statusCode,
      cause: error instanceof Error ? error : undefined,
    });
  }

  toJSON(): Record<string, unknown> {
    return {
      code: this.code,
      message: this.message,
      provider: this.provider,
      retryable: this.retryable,
      providerCode: this.providerCode,
      statusCode: this.statusCode,
    };
  }
}

const ERROR_CODE_TO_I18N: Record<PaymentServiceErrorCode, string> = {
  CARD_DECLINED: 'billing:payments.cardDeclined',
  INSUFFICIENT_FUNDS: 'billing:payments.insufficientFunds',
  EXPIRED_CARD: 'billing:payments.expiredCard',
  PROVIDER_ERROR: 'billing:payments.providerError',
  NETWORK_ERROR: 'billing:payments.networkError',
  INVALID_REQUEST: 'billing:payments.invalidRequest',
  AUTHENTICATION_REQUIRED: 'billing:payments.authenticationRequired',
};

export function paymentErrorToI18nKey(code: PaymentServiceErrorCode): string {
  return ERROR_CODE_TO_I18N[code];
}

export function isRetryableError(error: unknown): boolean {
  if (error instanceof PaymentServiceError) return error.retryable;

  const stripeErr = error as { statusCode?: number; type?: string };
  if (stripeErr.statusCode != null && stripeErr.statusCode >= 500) return true;
  if (stripeErr.type === 'StripeConnectionError') return true;
  if (stripeErr.type === 'StripeRateLimitError') return true;

  if (error instanceof Error) {
    return (
      error.message.includes('ECONNREFUSED') ||
      error.message.includes('ETIMEDOUT') ||
      error.message.includes('ENOTFOUND') ||
      error.message.includes('fetch failed')
    );
  }

  return false;
}
