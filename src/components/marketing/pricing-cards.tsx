'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Check } from 'lucide-react';
import { motion } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { formatPrice, cn } from '@/lib/utils';

export type Plan = {
  id: string;
  tier: 'FREE' | 'BASIC' | 'PRO' | 'ENTERPRISE';
  name: string;
  description: string;
  priceMonthly: number;
  priceYearly: number;
  trialDays: number;
  features: string[];
  hasMonthlyPrice: boolean;
  hasYearlyPrice: boolean;
};

type Props = {
  plans: Plan[];
  authed: boolean;
  hasActiveSubscription: boolean;
};

export function PricingCards({ plans, authed, hasActiveSubscription }: Props) {
  const [interval, setInterval] = useState<'MONTH' | 'YEAR'>('MONTH');

  const yearlySavings = useMemo(() => {
    const pro = plans.find((p) => p.tier === 'PRO');
    if (!pro || !pro.priceMonthly || !pro.priceYearly) return null;
    const fullYear = pro.priceMonthly * 12;
    const saved = fullYear - pro.priceYearly;
    if (saved <= 0) return null;
    return Math.round((saved / fullYear) * 100);
  }, [plans]);

  return (
    <div>
      <div className="flex flex-col items-center gap-2">
        <div className="inline-flex items-center rounded-full border border-slate-200 bg-white p-1 text-sm dark:border-slate-800 dark:bg-slate-900">
          <button
            type="button"
            onClick={() => setInterval('MONTH')}
            className={cn(
              'rounded-full px-4 py-1.5 font-medium transition',
              interval === 'MONTH'
                ? 'bg-brand-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-300',
            )}
            aria-pressed={interval === 'MONTH'}
          >
            Monthly
          </button>
          <button
            type="button"
            onClick={() => setInterval('YEAR')}
            className={cn(
              'rounded-full px-4 py-1.5 font-medium transition',
              interval === 'YEAR'
                ? 'bg-brand-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-300',
            )}
            aria-pressed={interval === 'YEAR'}
          >
            Yearly
          </button>
        </div>
        {yearlySavings && (
          <p className="text-xs text-emerald-600 dark:text-emerald-400">
            Save up to {yearlySavings}% with annual billing
          </p>
        )}
      </div>

      <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        {plans.map((plan, i) => {
          const isFree = plan.tier === 'FREE';
          const highlight = plan.tier === 'PRO';
          const showYearly = interval === 'YEAR' && plan.priceYearly > 0;
          const price = showYearly ? plan.priceYearly : plan.priceMonthly;
          const period = showYearly ? '/yr' : '/mo';
          const purchasable =
            !isFree && (showYearly ? plan.hasYearlyPrice : plan.hasMonthlyPrice);

          return (
            <motion.div
              key={plan.id}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.35, delay: i * 0.05 }}
            >
              <Card className={cn('relative h-full', highlight && 'ring-2 ring-brand-500')}>
                {highlight && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-brand-600 px-3 py-1 text-xs font-semibold text-white">
                    Most popular
                  </span>
                )}
                <h3 className="text-lg font-semibold">{plan.name}</h3>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{plan.description}</p>

                <div className="mt-4 flex items-baseline gap-1">
                  <span className="text-3xl font-bold">
                    {isFree ? 'Free' : formatPrice(price)}
                  </span>
                  {!isFree && <span className="text-sm text-slate-500">{period}</span>}
                </div>
                {plan.trialDays > 0 && !isFree && (
                  <p className="mt-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                    {plan.trialDays}-day free trial
                  </p>
                )}

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
                    <Link href={authed ? '/dashboard' : '/register'} className="block">
                      <Button className="w-full" variant="outline">
                        {authed ? 'Go to dashboard' : 'Get started free'}
                      </Button>
                    </Link>
                  ) : !authed ? (
                    <Link
                      href={`/login?callbackUrl=${encodeURIComponent('/pricing')}`}
                      className="block"
                    >
                      <Button className="w-full" variant={highlight ? 'primary' : 'outline'}>
                        Sign in to subscribe
                      </Button>
                    </Link>
                  ) : hasActiveSubscription ? (
                    <Link href="/dashboard/billing" className="block">
                      <Button className="w-full" variant="outline">
                        Manage current plan
                      </Button>
                    </Link>
                  ) : (
                    <CheckoutForm
                      planId={plan.id}
                      interval={interval}
                      label={
                        plan.trialDays > 0
                          ? `Start ${plan.trialDays}-day trial`
                          : showYearly
                            ? 'Subscribe yearly'
                            : 'Subscribe monthly'
                      }
                      highlight={highlight}
                      disabled={!purchasable}
                    />
                  )}
                </div>
              </Card>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

import { createCheckoutAction } from '@/server/actions/billing';

function CheckoutForm({
  planId,
  interval,
  label,
  highlight,
  disabled,
}: {
  planId: string;
  interval: 'MONTH' | 'YEAR';
  label: string;
  highlight: boolean;
  disabled: boolean;
}) {
  return (
    <form action={createCheckoutAction}>
      <input type="hidden" name="planId" value={planId} />
      <input type="hidden" name="interval" value={interval} />
      <Button
        type="submit"
        className="w-full"
        variant={highlight ? 'primary' : 'outline'}
        disabled={disabled}
      >
        {disabled ? 'Not available' : label}
      </Button>
    </form>
  );
}
