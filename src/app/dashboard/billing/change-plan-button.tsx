'use client';

import { useState, useTransition } from 'react';
import { ArrowUpDown, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { changePlanAction } from '@/server/actions/billing';
import { cn, formatPrice } from '@/lib/utils';

type PlanOption = {
  id: string;
  tier: string;
  name: string;
  priceMonthly: number;
  priceYearly: number;
  hasMonthlyPrice: boolean;
  hasYearlyPrice: boolean;
};

export function ChangePlanButton({
  subscriptionId,
  currentPlanId,
  currentInterval,
  plans,
}: {
  subscriptionId: string;
  currentPlanId: string;
  currentInterval: 'MONTH' | 'YEAR';
  plans: PlanOption[];
}) {
  const [open, setOpen] = useState(false);
  const [interval, setInterval] = useState<'MONTH' | 'YEAR'>(currentInterval);
  const [pending, startTransition] = useTransition();
  const { toast } = useToast();

  function submit(planId: string) {
    const fd = new FormData();
    fd.set('subscriptionId', subscriptionId);
    fd.set('planId', planId);
    fd.set('interval', interval);
    startTransition(async () => {
      try {
        await changePlanAction(fd);
        toast({ tone: 'success', title: 'Plan updated', description: 'Proration applied via Stripe.' });
        setOpen(false);
      } catch (err) {
        toast({
          tone: 'error',
          title: 'Could not change plan',
          description: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    });
  }

  if (!open) {
    return (
      <Button variant="outline" type="button" onClick={() => setOpen(true)}>
        <ArrowUpDown className="h-4 w-4" /> Change plan
      </Button>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4"
      onClick={() => setOpen(false)}
    >
      <div
        className="relative w-full max-w-2xl rounded-2xl bg-white p-6 shadow-xl dark:bg-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Close"
          className="absolute right-3 top-3 rounded-md p-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          <X className="h-4 w-4" />
        </button>
        <h3 className="text-lg font-semibold">Change plan</h3>
        <p className="mt-1 text-sm text-slate-500">
          Stripe will create prorated charges or credits automatically.
        </p>

        <div className="mt-4 inline-flex items-center rounded-full border border-slate-200 bg-white p-1 text-sm dark:border-slate-800 dark:bg-slate-950">
          {(['MONTH', 'YEAR'] as const).map((i) => (
            <button
              key={i}
              type="button"
              onClick={() => setInterval(i)}
              className={cn(
                'rounded-full px-3 py-1 font-medium transition',
                interval === i
                  ? 'bg-brand-600 text-white'
                  : 'text-slate-600 dark:text-slate-300',
              )}
            >
              {i === 'MONTH' ? 'Monthly' : 'Yearly'}
            </button>
          ))}
        </div>

        <ul className="mt-5 space-y-2">
          {plans.map((p) => {
            const isCurrent = p.id === currentPlanId && interval === currentInterval;
            const available = interval === 'YEAR' ? p.hasYearlyPrice : p.hasMonthlyPrice;
            const price = interval === 'YEAR' ? p.priceYearly : p.priceMonthly;
            return (
              <li
                key={p.id}
                className="flex items-center justify-between rounded-xl border border-slate-200 p-3 dark:border-slate-800"
              >
                <div>
                  <p className="font-medium">
                    {p.name}{' '}
                    <span className="font-normal text-slate-500">— {formatPrice(price)}/{interval === 'YEAR' ? 'yr' : 'mo'}</span>
                  </p>
                  {isCurrent && (
                    <p className="text-xs text-emerald-600 dark:text-emerald-400">Your current plan</p>
                  )}
                </div>
                <Button
                  size="sm"
                  variant={isCurrent ? 'ghost' : 'primary'}
                  disabled={pending || isCurrent || !available}
                  onClick={() => submit(p.id)}
                >
                  {!available ? 'Not available' : isCurrent ? 'Current' : pending ? 'Switching…' : 'Switch'}
                </Button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
