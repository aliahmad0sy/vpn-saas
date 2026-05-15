import Link from 'next/link';
import { RegisterForm } from './register-form';

export const metadata = { title: 'Create your account' };

export default function RegisterPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">Create your account</h1>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        Free forever for personal use. No credit card required.
      </p>
      <div className="mt-8">
        <RegisterForm />
      </div>
      <p className="mt-6 text-sm text-slate-600 dark:text-slate-300">
        Already have an account?{' '}
        <Link href="/login" className="font-medium text-brand-600 hover:text-brand-700">
          Sign in
        </Link>
      </p>
    </div>
  );
}
