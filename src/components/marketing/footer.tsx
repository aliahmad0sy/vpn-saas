import Link from 'next/link';

export function MarketingFooter() {
  return (
    <footer className="border-t border-slate-200 dark:border-slate-800">
      <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-4 px-4 py-8 text-sm text-slate-500 sm:flex-row sm:px-6 lg:px-8 dark:text-slate-400">
        <p>© {new Date().getFullYear()} ShieldVPN. All rights reserved.</p>
        <div className="flex items-center gap-5">
          <Link href="/pricing" className="hover:text-slate-900 dark:hover:text-white">
            Pricing
          </Link>
          <Link href="/login" className="hover:text-slate-900 dark:hover:text-white">
            Log in
          </Link>
          <a
            href="https://www.wireguard.com/"
            target="_blank"
            rel="noreferrer"
            className="hover:text-slate-900 dark:hover:text-white"
          >
            Powered by WireGuard
          </a>
        </div>
      </div>
    </footer>
  );
}
