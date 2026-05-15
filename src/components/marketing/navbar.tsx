import Link from 'next/link';
import { Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function MarketingNavbar() {
  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/60 backdrop-blur dark:border-slate-800/60">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2 text-slate-900 dark:text-slate-100">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-600 text-white">
            <Shield className="h-4 w-4" />
          </span>
          <span className="text-base font-semibold tracking-tight">ShieldVPN</span>
        </Link>
        <nav className="hidden items-center gap-6 text-sm md:flex">
          <Link href="/pricing" className="text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white">
            Pricing
          </Link>
          <Link href="/#features" className="text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white">
            Features
          </Link>
          <Link href="/#servers" className="text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white">
            Servers
          </Link>
        </nav>
        <div className="flex items-center gap-2">
          <Link href="/login" className="hidden sm:block">
            <Button variant="ghost" size="sm">
              Log in
            </Button>
          </Link>
          <Link href="/register">
            <Button size="sm">Get started</Button>
          </Link>
        </div>
      </div>
    </header>
  );
}
