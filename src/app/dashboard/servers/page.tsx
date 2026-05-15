import { prisma } from '@/lib/prisma';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { requireUser } from '@/server/guards';

export const metadata = { title: 'Servers' };

export default async function ServersPage() {
  await requireUser();
  const servers = await prisma.server.findMany({
    orderBy: [{ status: 'asc' }, { country: 'asc' }, { name: 'asc' }],
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Servers</h1>
        <p className="text-sm text-slate-500">Available endpoints across our network.</p>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {servers.map((s) => {
          const tone = s.status === 'ONLINE' ? 'success' : s.status === 'MAINTENANCE' ? 'warning' : 'danger';
          const loadPct = Math.min(100, Math.round((s.load / Math.max(1, s.capacity)) * 100));
          return (
            <Card key={s.id}>
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold">{s.name}</p>
                  <p className="text-sm text-slate-500">{s.location}</p>
                </div>
                <Badge tone={tone}>{s.status.toLowerCase()}</Badge>
              </div>
              <div className="mt-4">
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>Load</span>
                  <span>{loadPct}%</span>
                </div>
                <div className="mt-1 h-1.5 rounded-full bg-slate-200 dark:bg-slate-800">
                  <div
                    className="h-1.5 rounded-full bg-brand-600"
                    style={{ width: `${loadPct}%` }}
                  />
                </div>
              </div>
              {s.premiumOnly && (
                <p className="mt-3 text-xs font-medium text-amber-600">Pro & Enterprise only</p>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
