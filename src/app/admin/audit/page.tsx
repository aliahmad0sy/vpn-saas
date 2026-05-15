import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/server/guards';
import { Card } from '@/components/ui/card';

export const metadata = { title: 'Audit log' };

export default async function AdminAuditPage() {
  await requireAdmin();
  const logs = await prisma.auditLog.findMany({
    orderBy: { createdAt: 'desc' },
    take: 200,
    include: { user: { select: { email: true } } },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Audit log</h1>
        <p className="text-sm text-slate-500">Most recent 200 events.</p>
      </div>
      <Card className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500 dark:bg-slate-900">
            <tr>
              <th className="px-4 py-3">Time</th>
              <th className="px-4 py-3">Actor</th>
              <th className="px-4 py-3">Action</th>
              <th className="px-4 py-3">Resource</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
            {logs.map((log) => (
              <tr key={log.id}>
                <td className="px-4 py-3 text-slate-500">{new Date(log.createdAt).toLocaleString()}</td>
                <td className="px-4 py-3">{log.user?.email ?? 'system'}</td>
                <td className="px-4 py-3 font-medium">{log.action}</td>
                <td className="px-4 py-3 text-slate-500">
                  {log.resource ?? '—'}
                  {log.resourceId ? ` · ${log.resourceId}` : ''}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
