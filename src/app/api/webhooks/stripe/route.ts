import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { stripe } from '@/lib/stripe';
import { env } from '@/lib/env';
import { logger } from '@/lib/logger';
import { audit } from '@/lib/audit';
import {
  markEventProcessed,
  syncInvoiceFromStripe,
  syncSubscriptionFromStripe,
} from '@/server/services/billing';

export const runtime = 'nodejs';

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

  const isNew = await markEventProcessed(event);
  if (!isNew) {
    logger.debug({ id: event.id, type: event.type }, 'Stripe event already processed (idempotent)');
    return NextResponse.json({ received: true, duplicate: true });
  }

  try {
    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
      case 'customer.subscription.trial_will_end':
        await syncSubscriptionFromStripe(event.data.object);
        break;

      case 'checkout.session.completed': {
        const session = event.data.object;
        if (session.subscription && typeof session.subscription === 'string') {
          const full = await stripe.subscriptions.retrieve(session.subscription);
          await syncSubscriptionFromStripe(full);
        }
        break;
      }

      case 'invoice.created':
      case 'invoice.finalized':
      case 'invoice.paid':
      case 'invoice.payment_succeeded':
      case 'invoice.payment_failed':
      case 'invoice.voided':
      case 'invoice.marked_uncollectible':
        await syncInvoiceFromStripe(event.data.object);
        if (
          event.type === 'invoice.payment_failed' ||
          event.type === 'invoice.paid' ||
          event.type === 'invoice.payment_succeeded'
        ) {
          const invoice = event.data.object;
          if (invoice.subscription && typeof invoice.subscription === 'string') {
            const sub = await stripe.subscriptions.retrieve(invoice.subscription);
            await syncSubscriptionFromStripe(sub);
          }
        }
        break;

      default:
        logger.debug({ type: event.type }, 'Unhandled Stripe event');
    }

    await audit({
      action: `stripe.${event.type}`,
      resource: 'stripe_event',
      resourceId: event.id,
    });
    return NextResponse.json({ received: true });
  } catch (err) {
    logger.error({ err, eventType: event.type, eventId: event.id }, 'Stripe webhook handler error');
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 });
  }
}
