import type Stripe from 'stripe';
import type { SubscriptionStatus, BillingInterval, InvoiceStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { stripe } from '@/lib/stripe';
import { logger } from '@/lib/logger';

const SUB_STATUS: Record<Stripe.Subscription.Status, SubscriptionStatus> = {
  trialing: 'TRIALING',
  active: 'ACTIVE',
  past_due: 'PAST_DUE',
  canceled: 'CANCELED',
  incomplete: 'INCOMPLETE',
  incomplete_expired: 'INCOMPLETE_EXPIRED',
  unpaid: 'UNPAID',
  paused: 'CANCELED',
};

const INVOICE_STATUS: Record<Stripe.Invoice.Status, InvoiceStatus> = {
  draft: 'DRAFT',
  open: 'OPEN',
  paid: 'PAID',
  uncollectible: 'UNCOLLECTIBLE',
  void: 'VOID',
};

function customerIdOf(sub: Stripe.Subscription): string {
  return typeof sub.customer === 'string' ? sub.customer : sub.customer.id;
}

async function resolveUserId(sub: Stripe.Subscription): Promise<string | null> {
  const fromMetadata = sub.metadata?.userId;
  if (fromMetadata && typeof fromMetadata === 'string') return fromMetadata;

  const customerId = customerIdOf(sub);
  const user = await prisma.user.findUnique({ where: { stripeCustomerId: customerId } });
  return user?.id ?? null;
}

async function resolvePlanId(sub: Stripe.Subscription): Promise<{ planId: string; interval: BillingInterval } | null> {
  const planMeta = sub.metadata?.planId;
  const priceId = sub.items.data[0]?.price?.id ?? null;
  const stripeInterval = sub.items.data[0]?.price?.recurring?.interval;
  const interval: BillingInterval = stripeInterval === 'year' ? 'YEAR' : 'MONTH';

  if (planMeta && typeof planMeta === 'string') {
    const plan = await prisma.plan.findUnique({ where: { id: planMeta } });
    if (plan) return { planId: plan.id, interval };
  }
  if (priceId) {
    const plan = await prisma.plan.findFirst({
      where: {
        OR: [{ stripePriceId: priceId }, { stripePriceIdYearly: priceId }],
      },
    });
    if (plan) return { planId: plan.id, interval };
  }
  return null;
}

export async function syncSubscriptionFromStripe(sub: Stripe.Subscription): Promise<void> {
  const userId = await resolveUserId(sub);
  if (!userId) {
    logger.warn({ subscriptionId: sub.id }, 'Sub event without resolvable user');
    return;
  }

  const planInfo = await resolvePlanId(sub);
  if (!planInfo) {
    logger.warn({ subscriptionId: sub.id }, 'Sub event without resolvable plan');
    return;
  }

  const data = {
    userId,
    planId: planInfo.planId,
    interval: planInfo.interval,
    status: SUB_STATUS[sub.status] ?? 'INCOMPLETE',
    stripeCustomerId: customerIdOf(sub),
    stripePriceId: sub.items.data[0]?.price?.id ?? null,
    currentPeriodStart: new Date(sub.current_period_start * 1000),
    currentPeriodEnd: new Date(sub.current_period_end * 1000),
    trialEnd: sub.trial_end ? new Date(sub.trial_end * 1000) : null,
    cancelAtPeriodEnd: sub.cancel_at_period_end,
    canceledAt: sub.canceled_at ? new Date(sub.canceled_at * 1000) : null,
  };

  await prisma.subscription.upsert({
    where: { stripeSubscriptionId: sub.id },
    update: data,
    create: { ...data, stripeSubscriptionId: sub.id },
  });
}

export async function syncInvoiceFromStripe(invoice: Stripe.Invoice): Promise<void> {
  if (!invoice.id) return;

  const customerId = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id;
  if (!customerId) return;

  const user = await prisma.user.findUnique({ where: { stripeCustomerId: customerId } });
  if (!user) {
    logger.warn({ invoiceId: invoice.id }, 'Invoice event without matching user');
    return;
  }

  const subscriptionRef =
    typeof invoice.subscription === 'string' ? invoice.subscription : invoice.subscription?.id ?? null;
  const subscription = subscriptionRef
    ? await prisma.subscription.findUnique({ where: { stripeSubscriptionId: subscriptionRef } })
    : null;

  const status: InvoiceStatus = invoice.status ? INVOICE_STATUS[invoice.status] : 'OPEN';

  const data = {
    userId: user.id,
    subscriptionId: subscription?.id ?? null,
    stripeCustomerId: customerId,
    number: invoice.number ?? null,
    status,
    amountDue: invoice.amount_due ?? 0,
    amountPaid: invoice.amount_paid ?? 0,
    currency: invoice.currency ?? 'usd',
    hostedInvoiceUrl: invoice.hosted_invoice_url ?? null,
    invoicePdfUrl: invoice.invoice_pdf ?? null,
    periodStart: invoice.period_start ? new Date(invoice.period_start * 1000) : null,
    periodEnd: invoice.period_end ? new Date(invoice.period_end * 1000) : null,
    paidAt: invoice.status_transitions?.paid_at
      ? new Date(invoice.status_transitions.paid_at * 1000)
      : null,
  };

  await prisma.invoice.upsert({
    where: { stripeInvoiceId: invoice.id },
    update: data,
    create: { ...data, stripeInvoiceId: invoice.id },
  });
}

/**
 * Records that we've handled this Stripe event. Returns true if the event was
 * new (and should be processed), false if it's a duplicate (re-delivery).
 */
export async function markEventProcessed(event: Stripe.Event): Promise<boolean> {
  try {
    await prisma.processedStripeEvent.create({
      data: { id: event.id, type: event.type },
    });
    return true;
  } catch {
    // unique-constraint violation => already processed
    return false;
  }
}

export { stripe };
