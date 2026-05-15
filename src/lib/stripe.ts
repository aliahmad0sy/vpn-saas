import Stripe from 'stripe';
import { env } from './env';

export const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
  typescript: true,
  appInfo: { name: 'vpn-saas', version: '0.1.0' },
});

export const STRIPE_PRICE_IDS = {
  BASIC: env.STRIPE_PRICE_BASIC,
  PRO: env.STRIPE_PRICE_PRO,
  ENTERPRISE: env.STRIPE_PRICE_ENTERPRISE,
} as const;
