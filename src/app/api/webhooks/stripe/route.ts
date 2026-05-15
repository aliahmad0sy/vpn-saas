import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { stripe } from '@/lib/stripe';
import { prisma } from '@/lib/prisma';
import { env } from '@/lib/env';
import { logger } from '@/lib/logger';
import { audit } from '@/lib/audit';
import type { SubscriptionStatus } from '@prisma/client';

export const runtime = 'nodejs';

const statusMap: Record<Stripe.Subscription.Status, SubscriptionStatus> = {
  trialing: 'TRIALING',
  active: 'ACTIVE',
  past_due: 'PAST_DUE',
  canceled: 'CANCELED',
  incomplete: 'INCOMPLETE',
  incomplete_expired: 'INCOMPLETE_EXPIRED',
  unpaid: 'UNPAID',
  paused: 'CANCELED',
};

async function upsertSubscription(sub: Stripe.Subscription) {
  const userId = (sub.metadata?.userId as string | undefined) ?? null;
  const planId = (sub.metadata?.planId as string | undefined) ?? null;

  let dbUserId = userId;
  if (!dbUserId && typeof sub.customer === 'string') {
    const user = await prisma.user.findUnique({ where: { stripeCustomerId: sub.customer } });
    dbUserId = user?.id ?? null;
  }
  if (!dbUserId) {
    logger.warn({ subscription: sub.id }, 'Stripe subscription event without resolvable user');
    return;
  }

  let dbPlanId = planId;
  if (!dbPlanId) {
    const priceId = sub.items.data[0]?.price?.id;
    if (priceId) {
      const plan = await prisma.plan.findFirst({ where: { stripePriceId: priceId } });
      dbPlanId = plan?.id ?? null;
    }
  }
  if (!dbPlanId) {
    logger.warn({ subscription: sub.id }, 'Stripe subscription event without resolvable plan');
    return;
  }

  await prisma.subscription.upsert({
    where: { stripeSubscriptionId: sub.id },
    update: {
      status: statusMap[sub.status] ?? 'INCOMPLETE',
      currentPeriodStart: new Date(sub.current_period_start * 1000),
      currentPeriodEnd: new Date(sub.current_period_end * 1000),
      cancelAtPeriodEnd: sub.cancel_at_period_end,
      canceledAt: sub.canceled_at ? new Date(sub.canceled_at * 1000) : null,
      planId: dbPlanId,
    },
    create: {
      userId: dbUserId,
      planId: dbPlanId,
      stripeSubscriptionId: sub.id,
      stripeCustomerId: typeof sub.customer === 'string' ? sub.customer : sub.customer.id,
      status: statusMap[sub.status] ?? 'INCOMPLETE',
      currentPeriodStart: new Date(sub.current_period_start * 1000),
      currentPeriodEnd: new Date(sub.current_period_end * 1000),
      cancelAtPeriodEnd: sub.cancel_at_period_end,
    },
  });
}

export async function POST(req: NextRequest) {
  const signature = req.headers.get('stripe-signature');
  if (!signature) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
  }
  const body = await req.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    logger.warn({ err }, 'Invalid Stripe webhook signature');
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  try {
    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
        await upsertSubscription(event.data.object);
        break;
      case 'checkout.session.completed': {
        const session = event.data.object;
        if (session.subscription && typeof session.subscription === 'string') {
          const full = await stripe.subscriptions.retrieve(session.subscription);
          await upsertSubscription(full);
        }
        break;
      }
      default:
        logger.debug({ type: event.type }, 'Unhandled Stripe event');
    }

    await audit({ action: `stripe.${event.type}`, resource: 'stripe_event', resourceId: event.id });
    return NextResponse.json({ received: true });
  } catch (err) {
    logger.error({ err, event: event.type }, 'Stripe webhook processing error');
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 });
  }
}
