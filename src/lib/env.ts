import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  NEXT_PUBLIC_APP_URL: z.string().url().default('http://localhost:3000'),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

  AUTH_SECRET: z.string().min(16, 'AUTH_SECRET must be at least 16 characters'),
  AUTH_TRUST_HOST: z
    .union([z.string(), z.boolean()])
    .transform((v) => v === true || v === 'true')
    .default(true),

  STRIPE_SECRET_KEY: z.string().default('sk_test_dummy'),
  STRIPE_WEBHOOK_SECRET: z.string().default('whsec_dummy'),
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().default('pk_test_dummy'),

  STRIPE_PRICE_BASIC: z.string().optional(),
  STRIPE_PRICE_BASIC_YEARLY: z.string().optional(),
  STRIPE_PRICE_PRO: z.string().optional(),
  STRIPE_PRICE_PRO_YEARLY: z.string().optional(),
  STRIPE_PRICE_ENTERPRISE: z.string().optional(),
  STRIPE_PRICE_ENTERPRISE_YEARLY: z.string().optional(),

  ADMIN_EMAIL: z.string().email().default('admin@example.com'),
  ADMIN_PASSWORD: z.string().min(8).default('ChangeMeNow123!'),

  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(100),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),

  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

  // 32 random bytes, base64-encoded — generate with `openssl rand -base64 32`.
  // If it's not 32 bytes b64, it'll be passed through scrypt to derive the key.
  ENCRYPTION_KEY: z.string().min(16, 'ENCRYPTION_KEY must be set'),

  // Shared secret for /api/cron/* routes; required to trigger background sweeps.
  CRON_SECRET: z.string().min(16, 'CRON_SECRET must be set'),

  // SSH connection timeout, per-server, for remote ops.
  SSH_TIMEOUT_MS: z.coerce.number().int().positive().default(15_000),

  // Transactional email (Resend). If RESEND_API_KEY is empty, sendEmail()
  // falls back to logging the message instead of dispatching — convenient
  // for dev, but a misconfiguration in production. EMAIL_FROM uses
  // "Name <addr>" syntax.
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().default('ShieldVPN <noreply@example.com>'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment variables:', parsed.error.flatten().fieldErrors);
  throw new Error('Invalid environment variables');
}

export const env = parsed.data;
