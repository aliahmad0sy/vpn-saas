import { prisma } from '@/lib/prisma';
import { Card } from '@/components/ui/card';
import { Users, Server, CreditCard, Activity } from 'lucide-react';

export const metadata = { title: 'Admin overview' };

export default async function AdminOverview() {
  const [userCount, serverCount, subscriptionCount, recent] = await Promise.all([
    prisma.user.count(),
    prisma.server.count(),
    prisma.subscription.count({ where: { status: { in: ['ACTIVE', 'TRIALING'] } } }),
    prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 8,
      include: { user: { select: { email: true } } },
    }),
  ]);

  const cards = [
    { icon: Users, label: 'Users', value: userCount },
    { icon: CreditCard, label: 'Active subscriptions', value: subscriptionCount },
    { icon: Server, label: 'Servers', value: serverCount },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Admin overview</h1>
        <p className="text-sm text-slate-500">Operational metrics across the platform.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {cards.map((c) => (
          <Card key={c.label}>
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-500">{c.label}</p>
              <c.icon className="h-4 w-4 text-brand-600" />
            </div>
            <p className="mt-2 text-3xl font-semibold">{c.value}</p>
          </Card>
        ))}
      </div>

      <Card>
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-brand-600" />
          <h2 className="font-semibold">Recent activity</h2>
        </div>
        <ul className="mt-4 divide-y divide-slate-200 dark:divide-slate-800">
          {recent.length === 0 && <li className="py-4 text-sm text-slate-500">No activity yet.</li>}
          {recent.map((log) => (
            <li key={log.id} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-medium">{log.action}</p>
                <p className="text-xs text-slate-500">
                  {log.user?.email ?? 'system'} · {log.resource ?? '—'}
                </p>
              </div>
              <p className="text-xs text-slate-400">{new Date(log.createdAt).toLocaleString()}</p>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
