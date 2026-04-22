export interface PaygRate {
  event: string;
  credits: number;
}

export interface CreditPack {
  size: number;
  priceCents: number;
  perCreditCents: number;
}

export const MAX_QUANTITY = 100_000;

export const CREDIT_PACKS: CreditPack[] = [
  { size: 1_000, priceCents: 1_000, perCreditCents: 1.0 },
  { size: 10_000, priceCents: 8_000, perCreditCents: 0.8 },
  { size: 100_000, priceCents: 60_000, perCreditCents: 0.6 },
];

export function clampQuantity(value: number): number {
  if (!Number.isFinite(value) || value < 0) return 0;
  return Math.min(Math.floor(value), MAX_QUANTITY);
}

export function computeTotalCredits(
  rates: PaygRate[],
  quantities: Record<string, number>,
): number {
  let total = 0;
  for (const rate of rates) {
    const qty = clampQuantity(quantities[rate.event] ?? 0);
    total += rate.credits * qty;
  }
  return total;
}

export function recommendPack(totalCredits: number): CreditPack {
  for (let i = CREDIT_PACKS.length - 1; i >= 0; i--) {
    if (totalCredits >= CREDIT_PACKS[i].size) return CREDIT_PACKS[i];
  }
  return CREDIT_PACKS[0];
}

export function estimateMonthlyCostCents(totalCredits: number): number {
  const pack = recommendPack(totalCredits);
  const packsNeeded = Math.ceil(totalCredits / pack.size) || 0;
  return packsNeeded * pack.priceCents;
}

export function formatCents(
  cents: number,
  locale: string,
  options?: Partial<Intl.NumberFormatOptions>,
): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
    ...options,
  }).format(cents / 100);
}
