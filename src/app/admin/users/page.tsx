import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/server/guards';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { setUserRoleAction } from '@/server/actions/admin';
import { formatDate } from '@/lib/utils';

export const metadata = { title: 'Users' };

export default async function AdminUsersPage() {
  const admin = await requireAdmin();
  const users = await prisma.user.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      subscriptions: {
        where: { status: { in: ['ACTIVE', 'TRIALING'] } },
        include: { plan: true },
        take: 1,
      },
      _count: { select: { vpnConfigs: true } },
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Users</h1>
        <p className="text-sm text-slate-500">All registered accounts.</p>
      </div>
      <Card className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500 dark:bg-slate-900">
            <tr>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Plan</th>
              <th className="px-4 py-3">Devices</th>
              <th className="px-4 py-3">Joined</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
            {users.map((u) => {
              const sub = u.subscriptions[0];
              return (
                <tr key={u.id}>
                  <td className="px-4 py-3">
                    <p className="font-medium">{u.name ?? '—'}</p>
                    <p className="text-xs text-slate-500">{u.email}</p>
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={u.role === 'ADMIN' ? 'warning' : 'default'}>{u.role}</Badge>
                  </td>
                  <td className="px-4 py-3">{sub?.plan.name ?? '—'}</td>
                  <td className="px-4 py-3">{u._count.vpnConfigs}</td>
                  <td className="px-4 py-3 text-slate-500">{formatDate(u.createdAt)}</td>
                  <td className="px-4 py-3">
                    {u.id !== admin.id && (
                      <form action={setUserRoleAction}>
                        <input type="hidden" name="userId" value={u.id} />
                        <input type="hidden" name="role" value={u.role === 'ADMIN' ? 'USER' : 'ADMIN'} />
                        <Button type="submit" variant="outline" size="sm">
                          {u.role === 'ADMIN' ? 'Make user' : 'Make admin'}
                        </Button>
                      </form>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
