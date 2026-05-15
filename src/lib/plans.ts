import type { Plan, PlanTier } from '@prisma/client';

export const TIER_ORDER: readonly PlanTier[] = ['FREE', 'BASIC', 'PRO', 'ENTERPRISE'] as const;

export function sortByTier<T extends { tier: PlanTier }>(plans: T[]): T[] {
  return [...plans].sort((a, b) => TIER_ORDER.indexOf(a.tier) - TIER_ORDER.indexOf(b.tier));
}

export function priceIdForInterval(
  plan: Pick<Plan, 'stripePriceId' | 'stripePriceIdYearly'>,
  interval: 'MONTH' | 'YEAR',
): string | null {
  return interval === 'YEAR' ? plan.stripePriceIdYearly : plan.stripePriceId;
}
