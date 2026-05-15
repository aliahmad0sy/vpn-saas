import Link from 'next/link';
import { requireUser } from '@/server/guards';
import { prisma } from '@/lib/prisma';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatDate, formatPrice } from '@/lib/utils';
import { subscriptionStatusTone, invoiceStatusTone } from '@/lib/status';
import { sortByTier } from '@/lib/plans';
import {
  createPortalSessionAction,
  reconcileSubscriptionAction,
} from '@/server/actions/billing';
import { CurrentPlanCard } from './current-plan-card';
import { ChangePlanButton } from './change-plan-button';
import { CancelResumeControls } from './cancel-resume-controls';

export const metadata = { title: 'Billing' };

export default async function BillingPage() {
  const user = await requireUser();

  const [activeSub, allSubs, invoices, dbUser, plans] = await Promise.all([
    prisma.subscription.findFirst({
      where: { userId: user.id, status: { in: ['ACTIVE', 'TRIALING', 'PAST_DUE'] } },
      include: { plan: true },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.subscription.findMany({
      where: { userId: user.id },
      include: { plan: true },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.invoice.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 25,
    }),
    prisma.user.findUnique({ where: { id: user.id }, select: { stripeCustomerId: true } }),
    prisma.plan.findMany({ where: { active: true } }).then(sortByTier),
  ]);

  const switchablePlans = plans
    .filter((p) => p.tier !== 'FREE')
    .map((p) => ({
      id: p.id,
      tier: p.tier,
      name: p.name,
      priceMonthly: p.priceMonthly,
      priceYearly: p.priceYearly,
      hasMonthlyPrice: !!p.stripePriceId,
      hasYearlyPrice: !!p.stripePriceIdYearly,
    }));

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Billing</h1>
          <p className="text-sm text-slate-500">Manage your subscription, plan, and invoices.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/pricing">
            <Button variant="outline">View all plans</Button>
          </Link>
          {dbUser?.stripeCustomerId && (
            <form action={createPortalSessionAction}>
              <Button type="submit" variant="outline">
                Stripe portal
              </Button>
            </form>
          )}
          {activeSub && (
            <form action={reconcileSubscriptionAction}>
              <input type="hidden" name="subscriptionId" value={activeSub.id} />
              <Button type="submit" variant="ghost">
                Sync
              </Button>
            </form>
          )}
        </div>
      </div>

      {activeSub ? (
        <CurrentPlanCard
          subscription={{
            id: activeSub.id,
            status: activeSub.status,
            interval: activeSub.interval,
            currentPeriodEnd: activeSub.currentPeriodEnd?.toISOString() ?? null,
            trialEnd: activeSub.trialEnd?.toISOString() ?? null,
            cancelAtPeriodEnd: activeSub.cancelAtPeriodEnd,
            plan: {
              id: activeSub.plan.id,
              name: activeSub.plan.name,
              tier: activeSub.plan.tier,
              priceMonthly: activeSub.plan.priceMonthly,
              priceYearly: activeSub.plan.priceYearly,
            },
          }}
          actions={
            <div className="flex flex-wrap gap-2">
              <ChangePlanButton
                subscriptionId={activeSub.id}
                currentPlanId={activeSub.planId}
                currentInterval={activeSub.interval}
                plans={switchablePlans}
              />
              <CancelResumeControls
                subscriptionId={activeSub.id}
                cancelAtPeriodEnd={activeSub.cancelAtPeriodEnd}
                periodEnd={activeSub.currentPeriodEnd?.toISOString() ?? null}
              />
            </div>
          }
        />
      ) : (
        <Card>
          <h2 className="text-lg font-semibold">No active subscription</h2>
          <p className="mt-1 text-sm text-slate-500">
            Subscribe to a plan to start adding devices.
          </p>
          <Link href="/pricing" className="mt-4 inline-block">
            <Button>Choose a plan</Button>
          </Link>
        </Card>
      )}

      <Card>
        <h2 className="font-semibold">Subscription history</h2>
        <p className="text-sm text-slate-500">All subscriptions tied to your account.</p>
        <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500 dark:bg-slate-900">
              <tr>
                <th className="px-4 py-2">Plan</th>
                <th className="px-4 py-2">Interval</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2">Period end</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {allSubs.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-slate-500">
                    No subscriptions yet.
                  </td>
                </tr>
              )}
              {allSubs.map((s) => (
                <tr key={s.id}>
                  <td className="px-4 py-3 font-medium">{s.plan.name}</td>
                  <td className="px-4 py-3 capitalize">{s.interval.toLowerCase()}</td>
                  <td className="px-4 py-3">
                    <Badge tone={subscriptionStatusTone[s.status]}>{s.status.toLowerCase()}</Badge>
                  </td>
                  <td className="px-4 py-3">{formatDate(s.currentPeriodEnd)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card>
        <h2 className="font-semibold">Invoices</h2>
        <p className="text-sm text-slate-500">
          Hosted invoices and downloadable PDFs from Stripe.
        </p>
        <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500 dark:bg-slate-900">
              <tr>
                <th className="px-4 py-2">Number</th>
                <th className="px-4 py-2">Date</th>
                <th className="px-4 py-2">Amount</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2 text-right">View</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {invoices.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-slate-500">
                    No invoices yet. They&apos;ll appear here once Stripe posts them.
                  </td>
                </tr>
              )}
              {invoices.map((inv) => (
                <tr key={inv.id}>
                  <td className="px-4 py-3 font-mono text-xs">{inv.number ?? inv.stripeInvoiceId.slice(0, 12)}</td>
                  <td className="px-4 py-3">{formatDate(inv.createdAt)}</td>
                  <td className="px-4 py-3">{formatPrice(inv.amountDue, inv.currency)}</td>
                  <td className="px-4 py-3">
                    <Badge tone={invoiceStatusTone[inv.status]}>
                      {inv.status.toLowerCase()}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex gap-2">
                      {inv.hostedInvoiceUrl && (
                        <a
                          href={inv.hostedInvoiceUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-sm text-brand-600 hover:underline"
                        >
                          View
                        </a>
                      )}
                      {inv.invoicePdfUrl && (
                        <a
                          href={inv.invoicePdfUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-sm text-brand-600 hover:underline"
                        >
                          PDF
                        </a>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
