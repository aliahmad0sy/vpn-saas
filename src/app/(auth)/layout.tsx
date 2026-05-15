import Link from 'next/link';
import { Shield } from 'lucide-react';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen grid-cols-1 lg:grid-cols-2">
      <div className="hidden lg:flex flex-col justify-between bg-gradient-to-br from-brand-700 to-brand-900 p-10 text-white">
        <Link href="/" className="flex items-center gap-2 text-white">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-white/15">
            <Shield className="h-4 w-4" />
          </span>
          <span className="text-base font-semibold">ShieldVPN</span>
        </Link>
        <div>
          <h2 className="text-3xl font-bold leading-tight">
            Modern WireGuard VPN<br />for teams and creators.
          </h2>
          <p className="mt-3 max-w-sm text-brand-100">
            Encrypted tunnels in seconds, zero logs, global routing — built for the way the internet
            actually works.
          </p>
        </div>
        <p suppressHydrationWarning className="text-sm text-brand-200">
          © {new Date().getFullYear()} ShieldVPN
        </p>
      </div>
      <div className="flex flex-col">
        <header className="flex items-center justify-end p-6">
          <Link href="/" className="text-sm text-slate-500 hover:text-slate-900 dark:text-slate-400">
            ← Back to site
          </Link>
        </header>
        <main className="flex flex-1 items-center justify-center px-6 pb-12">
          <div className="w-full max-w-sm">{children}</div>
        </main>
      </div>
    </div>
  );
}
