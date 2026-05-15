import Link from 'next/link';
import { LoginForm } from './login-form';

export const metadata = { title: 'Log in' };

export default function LoginPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">Welcome back</h1>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        Sign in to manage your VPN configs and billing.
      </p>
      <div className="mt-8">
        <LoginForm />
      </div>
      <p className="mt-6 text-sm text-slate-600 dark:text-slate-300">
        Don&apos;t have an account?{' '}
        <Link href="/register" className="font-medium text-brand-600 hover:text-brand-700">
          Create one
        </Link>
      </p>
    </div>
  );
}
