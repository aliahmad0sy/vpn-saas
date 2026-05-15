'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import { stripe } from '@/lib/stripe';
import { prisma } from '@/lib/prisma';
import { env } from '@/lib/env';
import { requireUser } from '@/server/guards';
import { audit } from '@/lib/audit';

const checkoutSchema = z.object({ planId: z.string().min(1) });

export async function createCheckoutAction(formData: FormData) {
  const user = await requireUser();
  const parsed = checkoutSchema.safeParse({ planId: formData.get('planId') });
  if (!parsed.success) throw new Error('Invalid plan');

  const plan = await prisma.plan.findUnique({ where: { id: parsed.data.planId } });
  if (!plan || !plan.active) throw new Error('Plan unavailable');
  if (!plan.stripePriceId) throw new Error('Plan is not purchasable');

  const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
  if (!dbUser) throw new Error('User not found');

  let customerId = dbUser.stripeCustomerId;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: dbUser.email,
      name: dbUser.name ?? undefined,
      metadata: { userId: dbUser.id },
    });
    customerId = customer.id;
    await prisma.user.update({ where: { id: dbUser.id }, data: { stripeCustomerId: customerId } });
  }

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    line_items: [{ price: plan.stripePriceId, quantity: 1 }],
    success_url: `${env.NEXT_PUBLIC_APP_URL}/dashboard/billing?toast=success&message=${encodeURIComponent(
      'Subscription activated. It may take a moment to appear.',
    )}`,
    cancel_url: `${env.NEXT_PUBLIC_APP_URL}/pricing?toast=info&message=${encodeURIComponent('Checkout canceled.')}`,
    subscription_data: { metadata: { userId: dbUser.id, planId: plan.id } },
    allow_promotion_codes: true,
  });

  await audit({
    userId: dbUser.id,
    action: 'billing.checkout.created',
    resource: 'checkout_session',
    resourceId: session.id,
    metadata: { planId: plan.id },
  });

  if (!session.url) throw new Error('Stripe did not return a session URL');
  redirect(session.url);
}

export async function createPortalSessionAction() {
  const user = await requireUser();
  const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
  if (!dbUser?.stripeCustomerId) throw new Error('No billing account yet');

  const session = await stripe.billingPortal.sessions.create({
    customer: dbUser.stripeCustomerId,
    return_url: `${env.NEXT_PUBLIC_APP_URL}/dashboard/billing`,
  });
  redirect(session.url);
}
