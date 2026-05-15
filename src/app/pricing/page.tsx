import { MarketingNavbar } from '@/components/marketing/navbar';
import { MarketingFooter } from '@/components/marketing/footer';
import { PricingCards, type Plan } from '@/components/marketing/pricing-cards';
import { prisma } from '@/lib/prisma';
import { auth } from '@/server/auth';

export const metadata = { title: 'Pricing' };

const tierOrder = ['FREE', 'BASIC', 'PRO', 'ENTERPRISE'] as const;

export default async function PricingPage() {
  const [plans, session] = await Promise.all([
    prisma.plan
      .findMany({ where: { active: true } })
      .then((rows) => rows.sort((a, b) => tierOrder.indexOf(a.tier) - tierOrder.indexOf(b.tier)))
      .catch(() => [] as Awaited<ReturnType<typeof prisma.plan.findMany>>),
    auth(),
  ]);

  let hasActiveSubscription = false;
  if (session?.user?.id) {
    hasActiveSubscription = !!(await prisma.subscription
      .findFirst({
        where: {
          userId: session.user.id,
          status: { in: ['ACTIVE', 'TRIALING', 'PAST_DUE'] },
        },
        select: { id: true },
      })
      .catch(() => null));
  }

  const cardPlans: Plan[] = plans.map((p) => ({
    id: p.id,
    tier: p.tier,
    name: p.name,
    description: p.description,
    priceMonthly: p.priceMonthly,
    priceYearly: p.priceYearly,
    trialDays: p.trialDays,
    features: p.features,
    hasMonthlyPrice: !!p.stripePriceId,
    hasYearlyPrice: !!p.stripePriceIdYearly,
  }));

  return (
    <>
      <MarketingNavbar />
      <main className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h1 className="text-4xl font-bold tracking-tight">Pricing</h1>
          <p className="mt-3 text-slate-600 dark:text-slate-300">
            Pay monthly or save with yearly billing. Cancel any time. Encrypted, no-log
            infrastructure on every plan.
          </p>
        </div>

        <div className="mt-12">
          {cardPlans.length > 0 ? (
            <PricingCards
              plans={cardPlans}
              authed={!!session?.user}
              hasActiveSubscription={hasActiveSubscription}
            />
          ) : (
            <p className="text-center text-sm text-slate-500">
              Pricing loads after the database is seeded.
            </p>
          )}
        </div>
      </main>
      <MarketingFooter />
    </>
  );
}
