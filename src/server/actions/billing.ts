'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { stripe } from '@/lib/stripe';
import { prisma } from '@/lib/prisma';
import { env } from '@/lib/env';
import { priceIdForInterval } from '@/lib/plans';
import { requireUser } from '@/server/guards';
import { audit } from '@/lib/audit';
import { syncSubscriptionFromStripe, syncInvoiceFromStripe } from '@/server/services/billing';

const intervalSchema = z.enum(['MONTH', 'YEAR']).default('MONTH');

const checkoutSchema = z.object({
  planId: z.string().min(1),
  interval: intervalSchema,
});

async function ensureCustomerId(userId: string): Promise<string> {
  const dbUser = await prisma.user.findUnique({ where: { id: userId } });
  if (!dbUser) throw new Error('User not found');
  if (dbUser.stripeCustomerId) return dbUser.stripeCustomerId;

  const customer = await stripe.customers.create({
    email: dbUser.email,
    name: dbUser.name ?? undefined,
    metadata: { userId: dbUser.id },
  });
  await prisma.user.update({
    where: { id: dbUser.id },
    data: { stripeCustomerId: customer.id },
  });
  return customer.id;
}

export async function createCheckoutAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const parsed = checkoutSchema.safeParse({
    planId: formData.get('planId'),
    interval: formData.get('interval') ?? 'MONTH',
  });
  if (!parsed.success) throw new Error('Invalid plan or interval');

  const plan = await prisma.plan.findUnique({ where: { id: parsed.data.planId } });
  if (!plan || !plan.active) throw new Error('Plan unavailable');

  const priceId = priceIdForInterval(plan, parsed.data.interval);
  if (!priceId) throw new Error('This plan is not configured for the selected interval');

  // Block duplicate active subscriptions — they should use the change-plan flow instead.
  const existing = await prisma.subscription.findFirst({
    where: {
      userId: user.id,
      status: { in: ['ACTIVE', 'TRIALING', 'PAST_DUE'] },
    },
  });
  if (existing) {
    throw new Error('You already have an active subscription. Use "Change plan" to switch.');
  }

  const customerId = await ensureCustomerId(user.id);

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${env.NEXT_PUBLIC_APP_URL}/dashboard/billing?toast=success&message=${encodeURIComponent(
      'Subscription activated. It may take a moment to appear.',
    )}`,
    cancel_url: `${env.NEXT_PUBLIC_APP_URL}/pricing?toast=info&message=${encodeURIComponent('Checkout canceled.')}`,
    subscription_data: {
      metadata: { userId: user.id, planId: plan.id },
      ...(plan.trialDays > 0 ? { trial_period_days: plan.trialDays } : {}),
    },
    allow_promotion_codes: true,
    client_reference_id: user.id,
  });

  await audit({
    userId: user.id,
    action: 'billing.checkout.created',
    resource: 'checkout_session',
    resourceId: session.id,
    metadata: { planId: plan.id, interval: parsed.data.interval },
  });

  if (!session.url) throw new Error('Stripe did not return a session URL');
  redirect(session.url);
}

export async function createPortalSessionAction(): Promise<void> {
  const user = await requireUser();
  const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
  if (!dbUser?.stripeCustomerId) throw new Error('No billing account yet — subscribe to a plan first.');

  const session = await stripe.billingPortal.sessions.create({
    customer: dbUser.stripeCustomerId,
    return_url: `${env.NEXT_PUBLIC_APP_URL}/dashboard/billing`,
  });
  redirect(session.url);
}

const cancelSchema = z.object({
  subscriptionId: z.string().min(1),
  immediately: z.union([z.literal('on'), z.string().optional()]).optional(),
});

export async function cancelSubscriptionAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const parsed = cancelSchema.safeParse({
    subscriptionId: formData.get('subscriptionId'),
    immediately: formData.get('immediately') ?? undefined,
  });
  if (!parsed.success) throw new Error('Invalid request');

  const sub = await prisma.subscription.findUnique({
    where: { id: parsed.data.subscriptionId },
  });
  if (!sub || sub.userId !== user.id) throw new Error('Subscription not found');
  if (!sub.stripeSubscriptionId) throw new Error('Subscription is not linked to Stripe');

  const immediate = parsed.data.immediately === 'on';
  const updated = immediate
    ? await stripe.subscriptions.cancel(sub.stripeSubscriptionId)
    : await stripe.subscriptions.update(sub.stripeSubscriptionId, {
        cancel_at_period_end: true,
      });

  await syncSubscriptionFromStripe(updated);
  await audit({
    userId: user.id,
    action: immediate ? 'billing.subscription.canceled_immediately' : 'billing.subscription.scheduled_cancel',
    resource: 'subscription',
    resourceId: sub.id,
  });
  revalidatePath('/dashboard/billing');
}

const resumeSchema = z.object({ subscriptionId: z.string().min(1) });

export async function resumeSubscriptionAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const parsed = resumeSchema.safeParse({ subscriptionId: formData.get('subscriptionId') });
  if (!parsed.success) throw new Error('Invalid request');

  const sub = await prisma.subscription.findUnique({ where: { id: parsed.data.subscriptionId } });
  if (!sub || sub.userId !== user.id) throw new Error('Subscription not found');
  if (!sub.stripeSubscriptionId) throw new Error('Subscription is not linked to Stripe');
  if (!sub.cancelAtPeriodEnd) throw new Error('Subscription is not scheduled to cancel');

  const updated = await stripe.subscriptions.update(sub.stripeSubscriptionId, {
    cancel_at_period_end: false,
  });

  await syncSubscriptionFromStripe(updated);
  await audit({
    userId: user.id,
    action: 'billing.subscription.resumed',
    resource: 'subscription',
    resourceId: sub.id,
  });
  revalidatePath('/dashboard/billing');
}

const changePlanSchema = z.object({
  subscriptionId: z.string().min(1),
  planId: z.string().min(1),
  interval: intervalSchema,
});

export async function changePlanAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const parsed = changePlanSchema.safeParse({
    subscriptionId: formData.get('subscriptionId'),
    planId: formData.get('planId'),
    interval: formData.get('interval') ?? 'MONTH',
  });
  if (!parsed.success) throw new Error('Invalid request');

  const sub = await prisma.subscription.findUnique({ where: { id: parsed.data.subscriptionId } });
  if (!sub || sub.userId !== user.id) throw new Error('Subscription not found');
  if (!sub.stripeSubscriptionId) throw new Error('Subscription is not linked to Stripe');

  const plan = await prisma.plan.findUnique({ where: { id: parsed.data.planId } });
  if (!plan || !plan.active) throw new Error('Plan unavailable');

  const newPriceId = priceIdForInterval(plan, parsed.data.interval);
  if (!newPriceId) throw new Error('This plan is not configured for the selected interval');

  // No-op if already on the same price.
  if (sub.stripePriceId === newPriceId) {
    throw new Error('You are already on this plan and interval.');
  }

  const existing = await stripe.subscriptions.retrieve(sub.stripeSubscriptionId);
  const itemId = existing.items.data[0]?.id;
  if (!itemId) throw new Error('Unable to locate subscription item');

  const updated = await stripe.subscriptions.update(sub.stripeSubscriptionId, {
    items: [{ id: itemId, price: newPriceId }],
    proration_behavior: 'create_prorations',
    metadata: { ...existing.metadata, userId: user.id, planId: plan.id },
  });

  await syncSubscriptionFromStripe(updated);
  await audit({
    userId: user.id,
    action: 'billing.subscription.changed',
    resource: 'subscription',
    resourceId: sub.id,
    metadata: { planId: plan.id, interval: parsed.data.interval },
  });
  revalidatePath('/dashboard/billing');
}

const reconcileSchema = z.object({ subscriptionId: z.string().min(1) });

/**
 * Pulls the latest subscription state from Stripe and reconciles the DB.
 * Useful when the webhook lags or to force-refresh after the user returns
 * from the Stripe Billing Portal.
 */
export async function reconcileSubscriptionAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const parsed = reconcileSchema.safeParse({ subscriptionId: formData.get('subscriptionId') });
  if (!parsed.success) throw new Error('Invalid request');

  const sub = await prisma.subscription.findUnique({ where: { id: parsed.data.subscriptionId } });
  if (!sub || sub.userId !== user.id) throw new Error('Subscription not found');
  if (!sub.stripeSubscriptionId) throw new Error('Subscription is not linked to Stripe');

  const fresh = await stripe.subscriptions.retrieve(sub.stripeSubscriptionId);
  await syncSubscriptionFromStripe(fresh);

  // Also pull recent invoices for this customer so billing history stays fresh.
  if (sub.stripeCustomerId) {
    const invoices = await stripe.invoices.list({ customer: sub.stripeCustomerId, limit: 20 });
    for (const inv of invoices.data) await syncInvoiceFromStripe(inv);
  }
  revalidatePath('/dashboard/billing');
}
