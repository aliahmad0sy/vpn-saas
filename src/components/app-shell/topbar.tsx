export function Topbar({ user }: { user: { name?: string | null; email: string; role: 'USER' | 'ADMIN' } }) {
  const initials = (user.name ?? user.email).slice(0, 2).toUpperCase();
  return (
    <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-3 dark:border-slate-800 dark:bg-slate-950">
      <div>
        <p className="text-sm text-slate-500 dark:text-slate-400">Signed in as</p>
        <p className="text-sm font-medium">{user.name ?? user.email}</p>
      </div>
      <div className="flex items-center gap-3">
        {user.role === 'ADMIN' && (
          <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
            Admin
          </span>
        )}
        <span className="grid h-9 w-9 place-items-center rounded-full bg-brand-600 text-sm font-semibold text-white">
          {initials}
        </span>
      </div>
    </header>
  );
}
