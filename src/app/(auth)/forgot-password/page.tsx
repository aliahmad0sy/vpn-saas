import Link from 'next/link';
import { ForgotPasswordForm } from './forgot-password-form';

export const metadata = { title: 'Forgot password' };

type Search = { sent?: string };

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const { sent } = await searchParams;

  if (sent) {
    return (
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Check your email</h1>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          If an account exists with that email, we&apos;ve sent a password reset link. It expires
          in 1 hour. Be sure to check your spam folder.
        </p>
        <p className="mt-6 text-sm">
          <Link href="/login" className="font-medium text-brand-600 hover:text-brand-700">
            ← Back to sign in
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">Forgot your password?</h1>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        Enter your email and we&apos;ll send you a link to reset it.
      </p>
      <div className="mt-8">
        <ForgotPasswordForm />
      </div>
      <p className="mt-6 text-sm text-slate-600 dark:text-slate-300">
        Remembered it?{' '}
        <Link href="/login" className="font-medium text-brand-600 hover:text-brand-700">
          Sign in
        </Link>
      </p>
    </div>
  );
}
