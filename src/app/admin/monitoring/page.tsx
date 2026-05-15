import Link from 'next/link';
import { requireAdmin } from '@/server/guards';
import { prisma } from '@/lib/prisma';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatBytes, formatDate } from '@/lib/utils';
import { Activity, AlertTriangle, CheckCircle2, Cpu, Server as ServerIcon, Wifi } from 'lucide-react';

export const metadata = { title: 'Monitoring' };

const statusTone: Record<string, 'success' | 'warning' | 'danger' | 'default'> = {
  ONLINE: 'success',
  MAINTENANCE: 'warning',
  OFFLINE: 'danger',
};

export default async function MonitoringPage() {
  await requireAdmin();

  const [servers, peerCount, activeConfigs, expiringSoon, recentJobs, failedJobs, recentChecks, topConfigs] =
    await Promise.all([
      prisma.server.findMany({
        orderBy: [{ status: 'asc' }, { name: 'asc' }],
        include: {
          healthChecks: {
            orderBy: { checkedAt: 'desc' },
            take: 1,
          },
          _count: { select: { vpnConfigs: { where: { status: 'ACTIVE' } } } },
        },
      }),
      prisma.vpnConfig.count({ where: { status: 'ACTIVE' } }),
      prisma.vpnConfig.count({ where: { status: 'ACTIVE' } }),
      prisma.vpnConfig.count({
        where: {
          status: 'ACTIVE',
          expiresAt: {
            gte: new Date(),
            lte: new Date(Date.now() + 7 * 24 * 3600 * 1000),
          },
        },
      }),
      prisma.peerSyncJob.findMany({
        orderBy: { createdAt: 'desc' },
        take: 20,
        include: {
          server: { select: { name: true, hostname: true } },
        },
      }),
      prisma.peerSyncJob.count({ where: { status: 'FAILED' } }),
      prisma.serverHealthCheck.findMany({
        orderBy: { checkedAt: 'desc' },
        take: 15,
        include: { server: { select: { name: true } } },
      }),
      prisma.vpnConfig.findMany({
        where: { status: 'ACTIVE' },
        orderBy: { bytesRxTotal: 'desc' },
        take: 10,
        select: {
          id: true,
          name: true,
          bytesRxTotal: true,
          bytesTxTotal: true,
          lastUsedAt: true,
          user: { select: { email: true } },
          server: { select: { name: true } },
        },
      }),
    ]);

  const totalCapacity = servers.reduce((sum, s) => sum + s.capacity, 0);
  const totalPeers = servers.reduce((sum, s) => sum + s._count.vpnConfigs, 0);
  const onlineCount = servers.filter((s) => s.status === 'ONLINE').length;

  const stats = [
    { icon: ServerIcon, label: 'Servers online', value: `${onlineCount} / ${servers.length}` },
    { icon: Wifi, label: 'Active peers', value: totalPeers, sub: `of ${totalCapacity} capacity` },
    { icon: AlertTriangle, label: 'Failed sync jobs', value: failedJobs, sub: 'needs attention', danger: failedJobs > 0 },
    { icon: Activity, label: 'Expiring in 7d', value: expiringSoon, sub: 'configs to renew' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">VPN monitoring</h1>
          <p className="text-sm text-slate-500">
            Server health, peer sync state, traffic, and expirations.
          </p>
        </div>
        <Link
          href="/admin/servers"
          className="text-sm text-brand-600 hover:underline"
        >
          Manage servers →
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label}>
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-500">{s.label}</p>
              <s.icon className={s.danger ? 'h-4 w-4 text-red-500' : 'h-4 w-4 text-brand-600'} />
            </div>
            <p className={`mt-2 text-3xl font-semibold ${s.danger ? 'text-red-600 dark:text-red-400' : ''}`}>
              {s.value}
            </p>
            {s.sub && <p className="mt-1 text-xs text-slate-500">{s.sub}</p>}
          </Card>
        ))}
      </div>

      <Card>
        <div className="flex items-center gap-2">
          <Cpu className="h-4 w-4 text-brand-600" />
          <h2 className="font-semibold">Server fleet</h2>
        </div>
        <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500 dark:bg-slate-900">
              <tr>
                <th className="px-4 py-2">Server</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2">Peers</th>
                <th className="px-4 py-2">Last health</th>
                <th className="px-4 py-2">Latency</th>
                <th className="px-4 py-2">Last sync</th>
                <th className="px-4 py-2">Sync error</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {servers.map((s) => {
                const last = s.healthChecks[0];
                const managed = !!s.sshHost;
                const loadPct = Math.round((s._count.vpnConfigs / Math.max(1, s.capacity)) * 100);
                return (
                  <tr key={s.id}>
                    <td className="px-4 py-3">
                      <p className="font-medium">{s.name}</p>
                      <p className="text-xs text-slate-500">
                        {s.location}
                        {!managed && (
                          <span className="ml-2 inline-block rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-slate-500 dark:bg-slate-800">
                            unmanaged
                          </span>
                        )}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={statusTone[s.status] ?? 'default'}>{s.status.toLowerCase()}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      {s._count.vpnConfigs} / {s.capacity}{' '}
                      <span className="text-xs text-slate-400">({loadPct}%)</span>
                    </td>
                    <td className="px-4 py-3 text-slate-500">
                      {last?.checkedAt ? formatDate(last.checkedAt) : '—'}
                    </td>
                    <td className="px-4 py-3 text-slate-500">
                      {last?.latencyMs ? `${last.latencyMs}ms` : '—'}
                    </td>
                    <td className="px-4 py-3 text-slate-500">
                      {s.lastSyncedAt ? formatDate(s.lastSyncedAt) : '—'}
                    </td>
                    <td className="px-4 py-3 text-xs text-red-600 dark:text-red-400">
                      {s.lastSyncError ? s.lastSyncError.slice(0, 80) : ''}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-brand-600" />
            <h2 className="font-semibold">Recent sync jobs</h2>
          </div>
          <ul className="mt-3 divide-y divide-slate-200 text-sm dark:divide-slate-800">
            {recentJobs.length === 0 && <li className="py-3 text-slate-500">No jobs yet.</li>}
            {recentJobs.map((j) => (
              <li key={j.id} className="flex items-center justify-between py-2.5">
                <div>
                  <p className="font-medium">
                    {j.action} <span className="text-slate-500">on {j.server.name}</span>
                  </p>
                  <p className="text-xs text-slate-500">
                    {j.publicKey.slice(0, 12)}… · {formatDate(j.createdAt)}
                    {j.attempts > 1 && ` · ${j.attempts} attempts`}
                  </p>
                  {j.error && (
                    <p className="mt-1 text-xs text-red-600 dark:text-red-400">{j.error.slice(0, 90)}</p>
                  )}
                </div>
                <SyncStatusBadge status={j.status} />
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-brand-600" />
            <h2 className="font-semibold">Recent health checks</h2>
          </div>
          <ul className="mt-3 divide-y divide-slate-200 text-sm dark:divide-slate-800">
            {recentChecks.length === 0 && (
              <li className="py-3 text-slate-500">No health checks recorded.</li>
            )}
            {recentChecks.map((c) => (
              <li key={c.id} className="flex items-center justify-between py-2.5">
                <div>
                  <p className="font-medium">{c.server.name}</p>
                  <p className="text-xs text-slate-500">
                    {formatDate(c.checkedAt)} · {c.latencyMs ?? '—'}ms · {c.peerCount ?? '—'} peers
                  </p>
                  {c.error && (
                    <p className="mt-1 text-xs text-red-600 dark:text-red-400">{c.error.slice(0, 90)}</p>
                  )}
                </div>
                <Badge tone={statusTone[c.status] ?? 'default'}>{c.status.toLowerCase()}</Badge>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Card>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Wifi className="h-4 w-4 text-brand-600" />
            <h2 className="font-semibold">Top traffic — active peers</h2>
          </div>
          <p className="text-xs text-slate-500">{activeConfigs} active configs</p>
        </div>
        <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500 dark:bg-slate-900">
              <tr>
                <th className="px-4 py-2">Device</th>
                <th className="px-4 py-2">User</th>
                <th className="px-4 py-2">Server</th>
                <th className="px-4 py-2">Rx</th>
                <th className="px-4 py-2">Tx</th>
                <th className="px-4 py-2">Last handshake</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {topConfigs.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-slate-500">
                    Traffic data appears once /api/cron/collect-traffic runs against managed servers.
                  </td>
                </tr>
              )}
              {topConfigs.map((c) => (
                <tr key={c.id}>
                  <td className="px-4 py-3 font-medium">{c.name}</td>
                  <td className="px-4 py-3 text-slate-500">{c.user.email}</td>
                  <td className="px-4 py-3 text-slate-500">{c.server.name}</td>
                  <td className="px-4 py-3">{formatBytes(Number(c.bytesRxTotal))}</td>
                  <td className="px-4 py-3">{formatBytes(Number(c.bytesTxTotal))}</td>
                  <td className="px-4 py-3 text-slate-500">
                    {c.lastUsedAt ? formatDate(c.lastUsedAt) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function SyncStatusBadge({ status }: { status: string }) {
  const tone =
    status === 'SUCCEEDED'
      ? 'success'
      : status === 'FAILED'
        ? 'danger'
        : status === 'RUNNING'
          ? 'info'
          : 'default';
  return <Badge tone={tone}>{status.toLowerCase()}</Badge>;
}
