import { createHash } from 'crypto';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { ResetPasswordForm } from './reset-password-form';

export const metadata = { title: 'Reset password' };
export const dynamic = 'force-dynamic';

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

type Params = { token: string };

export default async function ResetPasswordPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { token } = await params;
  const tokenHash = hashToken(token);

  // Check token validity *before* rendering the form so a clearly-broken
  // link shows a useful message instead of letting the user type out a
  // new password just to be told it won't work.
  const row = await prisma.passwordResetToken
    .findUnique({ where: { tokenHash } })
    .catch(() => null);

  const valid = !!row && !row.usedAt && row.expiresAt > new Date();

  if (!valid) {
    return (
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Link expired</h1>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          This password reset link is invalid or has expired. Request a fresh one and try again.
        </p>
        <p className="mt-6 text-sm">
          <Link href="/forgot-password" className="font-medium text-brand-600 hover:text-brand-700">
            Get a new link
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">Choose a new password</h1>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        At least 8 characters. You&apos;ll be signed out of any other active sessions.
      </p>
      <div className="mt-8">
        <ResetPasswordForm token={token} />
      </div>
    </div>
  );
}
