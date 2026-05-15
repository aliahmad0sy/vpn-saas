import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatDate, formatPrice } from '@/lib/utils';

type Props = {
  subscription: {
    id: string;
    status: string;
    interval: 'MONTH' | 'YEAR';
    currentPeriodEnd: string | null;
    trialEnd: string | null;
    cancelAtPeriodEnd: boolean;
    plan: {
      id: string;
      name: string;
      tier: string;
      priceMonthly: number;
      priceYearly: number;
    };
  };
  actions: React.ReactNode;
};

const statusTone: Record<string, 'success' | 'warning' | 'danger' | 'info' | 'default'> = {
  ACTIVE: 'success',
  TRIALING: 'info',
  PAST_DUE: 'warning',
  UNPAID: 'danger',
};

export function CurrentPlanCard({ subscription: s, actions }: Props) {
  const isYearly = s.interval === 'YEAR';
  const price = isYearly ? s.plan.priceYearly : s.plan.priceMonthly;
  const period = isYearly ? 'year' : 'month';
  const inTrial = s.status === 'TRIALING' && s.trialEnd;

  return (
    <Card className="relative overflow-hidden">
      <div className="absolute inset-y-0 right-0 hidden h-full w-1/3 bg-gradient-to-l from-brand-600/10 to-transparent lg:block" />
      <div className="relative flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-semibold">{s.plan.name}</h2>
            <Badge tone={statusTone[s.status] ?? 'default'}>{s.status.toLowerCase()}</Badge>
            {s.cancelAtPeriodEnd && <Badge tone="warning">cancels at period end</Badge>}
          </div>
          <p className="mt-2 text-2xl font-bold">
            {formatPrice(price)}
            <span className="ml-1 text-base font-normal text-slate-500">/ {period}</span>
          </p>
          <dl className="mt-4 grid grid-cols-1 gap-x-8 gap-y-2 text-sm text-slate-500 sm:grid-cols-2">
            {inTrial && (
              <div>
                <dt className="font-medium text-slate-600 dark:text-slate-300">Trial ends</dt>
                <dd>{formatDate(s.trialEnd)}</dd>
              </div>
            )}
            <div>
              <dt className="font-medium text-slate-600 dark:text-slate-300">
                {s.cancelAtPeriodEnd ? 'Access until' : 'Renews on'}
              </dt>
              <dd>{formatDate(s.currentPeriodEnd)}</dd>
            </div>
            <div>
              <dt className="font-medium text-slate-600 dark:text-slate-300">Billing interval</dt>
              <dd className="capitalize">{s.interval.toLowerCase()}</dd>
            </div>
          </dl>
        </div>
        <div className="shrink-0">{actions}</div>
      </div>
    </Card>
  );
}
