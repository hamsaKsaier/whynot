const defaultFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const wholeFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})

export function formatCents(
  cents: number | string | null | undefined,
  options?: { locale?: string; currency?: string; whole?: boolean }
): string {
  const value = Number(cents ?? 0)
  if (!Number.isFinite(value)) return '$0.00'

  const dollars = value / 100

  if (options?.locale || options?.currency) {
    return new Intl.NumberFormat(options.locale ?? 'en-US', {
      style: 'currency',
      currency: options.currency ?? 'USD',
      minimumFractionDigits: options.whole ? 0 : 2,
      maximumFractionDigits: options.whole ? 0 : 2,
    }).format(dollars)
  }

  return (options?.whole ? wholeFormatter : defaultFormatter).format(dollars)
}

export function dollarsToCents(dollars: number | string): number {
  return Math.round(Number(dollars) * 100)
}

export function centsToDollars(cents: number | string): number {
  return Number(cents) / 100
}
