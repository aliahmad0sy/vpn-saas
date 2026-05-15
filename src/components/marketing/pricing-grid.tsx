'use client';

import { motion } from 'framer-motion';
import { Check } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { formatPrice } from '@/lib/utils';

export type PricingPlan = {
  id: string;
  tier: string;
  name: string;
  description: string;
  priceMonthly: number;
  features: string[];
  highlight?: boolean;
  cta: { href: string; label: string };
};

export function PricingGrid({ plans }: { plans: PricingPlan[] }) {
  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
      {plans.map((plan, i) => (
        <motion.div
          key={plan.id}
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4, delay: i * 0.05 }}
        >
          <Card
            className={
              plan.highlight
                ? 'relative ring-2 ring-brand-500'
                : 'relative'
            }
          >
            {plan.highlight && (
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-brand-600 px-3 py-1 text-xs font-semibold text-white">
                Most popular
              </span>
            )}
            <h3 className="text-lg font-semibold">{plan.name}</h3>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{plan.description}</p>
            <div className="mt-4 flex items-baseline gap-1">
              <span className="text-3xl font-bold">
                {plan.priceMonthly === 0 ? 'Free' : formatPrice(plan.priceMonthly)}
              </span>
              {plan.priceMonthly > 0 && (
                <span className="text-sm text-slate-500 dark:text-slate-400">/mo</span>
              )}
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
              <a href={plan.cta.href} className="block">
                <Button className="w-full" variant={plan.highlight ? 'primary' : 'outline'}>
                  {plan.cta.label}
                </Button>
              </a>
            </div>
          </Card>
        </motion.div>
      ))}
    </div>
  );
}
