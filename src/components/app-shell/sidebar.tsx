'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Shield, LayoutDashboard, Server, CreditCard, Users, Activity, ShieldCheck, LogOut, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';
import { logoutAction } from '@/server/actions/auth';

type Item = { href: string; label: string; icon: React.ComponentType<{ className?: string }> };

const userItems: Item[] = [
  { href: '/dashboard', label: 'Overview', icon: LayoutDashboard },
  { href: '/dashboard/servers', label: 'Servers', icon: Server },
  { href: '/dashboard/billing', label: 'Billing', icon: CreditCard },
  { href: '/dashboard/settings', label: 'Settings', icon: Settings },
];

const adminItems: Item[] = [
  { href: '/admin', label: 'Admin overview', icon: ShieldCheck },
  { href: '/admin/monitoring', label: 'Monitoring', icon: Activity },
  { href: '/admin/users', label: 'Users', icon: Users },
  { href: '/admin/servers', label: 'Servers', icon: Server },
  { href: '/admin/audit', label: 'Audit log', icon: Activity },
];

export function Sidebar({ role }: { role: 'USER' | 'ADMIN' }) {
  const pathname = usePathname();

  return (
    <aside className="hidden w-64 shrink-0 border-r border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950 lg:block">
      <Link href="/" className="mb-6 flex items-center gap-2">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-600 text-white">
          <Shield className="h-4 w-4" />
        </span>
        <span className="font-semibold">ShieldVPN</span>
      </Link>
      <nav className="space-y-1">
        <p className="px-2 py-1 text-xs font-semibold uppercase tracking-wider text-slate-400">
          Account
        </p>
        {userItems.map((item) => {
          const active = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm',
                active
                  ? 'bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300'
                  : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800',
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}

        {role === 'ADMIN' && (
          <>
            <p className="mt-6 px-2 py-1 text-xs font-semibold uppercase tracking-wider text-slate-400">
              Admin
            </p>
            {adminItems.map((item) => {
              const active = pathname === item.href || (item.href !== '/admin' && pathname.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm',
                    active
                      ? 'bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300'
                      : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800',
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </>
        )}
      </nav>

      <form action={logoutAction} className="mt-8">
        <button
          type="submit"
          className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </button>
      </form>
    </aside>
  );
}
