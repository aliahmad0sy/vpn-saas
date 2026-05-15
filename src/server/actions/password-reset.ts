'use server';

import { randomBytes, createHash } from 'crypto';
import { redirect } from 'next/navigation';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { env } from '@/lib/env';
import { sendEmail } from '@/lib/mail';
import { passwordResetEmail } from '@/lib/emails/password-reset';
import { audit } from '@/lib/audit';
import { logger } from '@/lib/logger';
import { rateLimit } from '@/lib/rate-limit';

const TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour
const RESET_RATE_LIMIT_PER_HOUR = 5;

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

const requestSchema = z.object({
  email: z.string().email().max(320),
});

/**
 * Always returns the same success state regardless of whether the email
 * exists. This prevents account-enumeration attacks via timing or response
 * differences. Heavy rate-limit per email so an attacker can't fire off
 * floods of reset emails for a target user.
 */
export async function requestPasswordResetAction(formData: FormData): Promise<void> {
  const parsed = requestSchema.safeParse({ email: formData.get('email') });
  if (!parsed.success) {
    // Don't reveal validation failure — same redirect as success.
    redirect('/forgot-password?sent=1');
  }

  const email = parsed.data.email.toLowerCase().trim();

  // Heavy per-email rate limit so this can't be used to spam a target's inbox.
  const { success } = rateLimit(`password-reset:${email}`, RESET_RATE_LIMIT_PER_HOUR);
  if (!success) {
    logger.warn({ email }, 'Password reset rate-limited');
    redirect('/forgot-password?sent=1');
  }

  const user = await prisma.user.findUnique({ where: { email }, select: { id: true, email: true, name: true, passwordHash: true } });

  // Only send if user exists AND has a password (accounts created via
  // OAuth-only would have no passwordHash to reset).
  if (user?.passwordHash) {
    // Invalidate any outstanding tokens for this user before issuing a new one,
    // so old emails can't be used after a fresh request.
    await prisma.passwordResetToken.updateMany({
      where: { userId: user.id, usedAt: null, expiresAt: { gt: new Date() } },
      data: { usedAt: new Date() },
    });

    const rawToken = randomBytes(32).toString('base64url');
    const tokenHash = hashToken(rawToken);
    const expiresAt = new Date(Date.now() + TOKEN_TTL_MS);

    await prisma.passwordResetToken.create({
      data: { tokenHash, userId: user.id, expiresAt },
    });

    const resetUrl = `${env.NEXT_PUBLIC_APP_URL}/reset-password/${rawToken}`;
    const message = passwordResetEmail({ name: user.name, resetUrl });
    await sendEmail({ to: user.email, ...message });

    await audit({
      userId: user.id,
      action: 'auth.password_reset.requested',
      resource: 'user',
      resourceId: user.id,
    });
  } else {
    // Log internally but don't tell the caller — preserves enumeration resistance.
    logger.info({ email }, 'Password reset requested for unknown / passwordless account');
  }

  redirect('/forgot-password?sent=1');
}

const resetSchema = z
  .object({
    token: z.string().min(20).max(200),
    password: z.string().min(8, 'Password must be at least 8 characters').max(128),
    confirm: z.string().min(1),
  })
  .refine((d) => d.password === d.confirm, {
    message: 'Passwords do not match',
    path: ['confirm'],
  });

export async function resetPasswordAction(formData: FormData): Promise<void> {
  const parsed = resetSchema.safeParse({
    token: formData.get('token'),
    password: formData.get('password'),
    confirm: formData.get('confirm'),
  });
  if (!parsed.success) {
    throw new Error(parsed.error.errors[0]?.message ?? 'Invalid input');
  }

  const tokenHash = hashToken(parsed.data.token);
  const row = await prisma.passwordResetToken.findUnique({ where: { tokenHash } });

  if (!row || row.usedAt || row.expiresAt < new Date()) {
    throw new Error('This reset link is invalid or has expired. Request a new one.');
  }

  const newHash = await bcrypt.hash(parsed.data.password, 12);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: row.userId },
      data: { passwordHash: newHash },
    }),
    prisma.passwordResetToken.update({
      where: { id: row.id },
      data: { usedAt: new Date() },
    }),
    // Invalidate any other outstanding reset tokens for the same user.
    prisma.passwordResetToken.updateMany({
      where: { userId: row.userId, usedAt: null, id: { not: row.id } },
      data: { usedAt: new Date() },
    }),
    // Sign out everywhere by deleting Auth.js session rows. JWT-strategy
    // sessions can't be invalidated server-side, so this is only a partial
    // measure if you swap session strategies later.
    prisma.session.deleteMany({ where: { userId: row.userId } }),
  ]);

  await audit({
    userId: row.userId,
    action: 'auth.password_reset.completed',
    resource: 'user',
    resourceId: row.userId,
  });

  redirect('/login?toast=success&message=' + encodeURIComponent('Password updated — sign in with your new password.'));
}
