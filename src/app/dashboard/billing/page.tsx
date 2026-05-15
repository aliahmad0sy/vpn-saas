import Link from 'next/link';
import { requireUser } from '@/server/guards';
import { prisma } from '@/lib/prisma';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatDate, formatPrice } from '@/lib/utils';
import { createPortalSessionAction } from '@/server/actions/billing';

export const metadata = { title: 'Billing' };

const statusTone: Record<string, 'success' | 'warning' | 'danger' | 'default' | 'info'> = {
  ACTIVE: 'success',
  TRIALING: 'info',
  PAST_DUE: 'warning',
  CANCELED: 'danger',
  INCOMPLETE: 'warning',
  INCOMPLETE_EXPIRED: 'danger',
  UNPAID: 'danger',
};

export default async function BillingPage({ searchParams }: { searchParams: Promise<{ success?: string }> }) {
  const user = await requireUser();
  const { success } = await searchParams;

  const [subscriptions, dbUser] = await Promise.all([
    prisma.subscription.findMany({
      where: { userId: user.id },
      include: { plan: true },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.user.findUnique({ where: { id: user.id }, select: { stripeCustomerId: true } }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Billing</h1>
        <p className="text-sm text-slate-500">Manage your subscription and payment method.</p>
      </div>

      {success && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-900/30 dark:text-emerald-200">
          Thanks — your subscription is being activated. You may need to refresh in a moment.
        </div>
      )}

      <Card>
        <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <h2 className="font-semibold">Subscription</h2>
            <p className="text-sm text-slate-500">View current plan or switch tiers.</p>
          </div>
          <div className="flex gap-2">
            <Link href="/pricing">
              <Button variant="outline">Change plan</Button>
            </Link>
            {dbUser?.stripeCustomerId && (
              <form action={createPortalSessionAction}>
                <Button type="submit">Manage in Stripe</Button>
              </form>
            )}
          </div>
        </div>

        <div className="mt-6 overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500 dark:bg-slate-900">
              <tr>
                <th className="px-4 py-2">Plan</th>
                <th className="px-4 py-2">Price</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2">Period end</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {subscriptions.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-slate-500">
                    No subscriptions yet.{' '}
                    <Link href="/pricing" className="text-brand-600 hover:underline">
                      Browse plans
                    </Link>
                    .
                  </td>
                </tr>
              )}
              {subscriptions.map((s) => (
                <tr key={s.id}>
                  <td className="px-4 py-3 font-medium">{s.plan.name}</td>
                  <td className="px-4 py-3">{formatPrice(s.plan.priceMonthly)}/mo</td>
                  <td className="px-4 py-3">
                    <Badge tone={statusTone[s.status] ?? 'default'}>{s.status.toLowerCase()}</Badge>
                  </td>
                  <td className="px-4 py-3">{formatDate(s.currentPeriodEnd)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
