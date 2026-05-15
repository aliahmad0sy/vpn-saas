import { MarketingNavbar } from '@/components/marketing/navbar';
import { MarketingFooter } from '@/components/marketing/footer';
import { prisma } from '@/lib/prisma';
import { auth } from '@/server/auth';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { formatPrice } from '@/lib/utils';
import { createCheckoutAction } from '@/server/actions/billing';
import Link from 'next/link';
import { Check } from 'lucide-react';

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

  return (
    <>
      <MarketingNavbar />
      <main className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h1 className="text-4xl font-bold tracking-tight">Pricing</h1>
          <p className="mt-3 text-slate-600 dark:text-slate-300">
            Pay monthly. Cancel any time. Encrypted, no-log infrastructure on every plan.
          </p>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
          {plans.map((plan) => {
            const isFree = plan.tier === 'FREE';
            const highlight = plan.tier === 'PRO';
            return (
              <Card key={plan.id} className={highlight ? 'relative ring-2 ring-brand-500' : 'relative'}>
                {highlight && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-brand-600 px-3 py-1 text-xs font-semibold text-white">
                    Most popular
                  </span>
                )}
                <h2 className="text-lg font-semibold">{plan.name}</h2>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{plan.description}</p>
                <div className="mt-4 flex items-baseline gap-1">
                  <span className="text-3xl font-bold">
                    {isFree ? 'Free' : formatPrice(plan.priceMonthly)}
                  </span>
                  {!isFree && <span className="text-sm text-slate-500">/mo</span>}
                </div>
                <ul className="mt-6 space-y-2 text-sm">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-6">
                  {isFree ? (
                    <Link href={session ? '/dashboard' : '/register'} className="block">
                      <Button className="w-full" variant="outline">
                        {session ? 'Go to dashboard' : 'Get started free'}
                      </Button>
                    </Link>
                  ) : session ? (
                    <form action={createCheckoutAction}>
                      <input type="hidden" name="planId" value={plan.id} />
                      <Button className="w-full" variant={highlight ? 'primary' : 'outline'} type="submit">
                        Subscribe
                      </Button>
                    </form>
                  ) : (
                    <Link href={`/login?callbackUrl=${encodeURIComponent('/pricing')}`} className="block">
                      <Button className="w-full" variant={highlight ? 'primary' : 'outline'}>
                        Sign in to subscribe
                      </Button>
                    </Link>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      </main>
      <MarketingFooter />
    </>
  );
}
