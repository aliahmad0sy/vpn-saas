import Link from 'next/link';
import { ShieldCheck, Server, Smartphone } from 'lucide-react';
import { requireUser } from '@/server/guards';
import { prisma } from '@/lib/prisma';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { formatDate } from '@/lib/utils';
import { ConfigList } from './config-list';
import { NewDeviceForm } from './new-device-form';

export const metadata = { title: 'Dashboard' };

export default async function DashboardOverview() {
  const user = await requireUser();
  const [configs, subscription, servers] = await Promise.all([
    prisma.vpnConfig.findMany({
      where: { userId: user.id },
      include: { server: true },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.subscription.findFirst({
      where: { userId: user.id, status: { in: ['ACTIVE', 'TRIALING'] } },
      include: { plan: true },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.server.findMany({ where: { status: 'ONLINE' }, orderBy: { name: 'asc' } }),
  ]);

  const activeDevices = configs.filter((c) => c.status === 'ACTIVE').length;
  const maxDevices = subscription?.plan.maxDevices ?? 0;
  const canAddDevice = !!subscription && activeDevices < maxDevices && servers.length > 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Welcome back</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Manage your devices and tunnels from here.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-500">Current plan</p>
            <ShieldCheck className="h-4 w-4 text-brand-600" />
          </div>
          <p className="mt-2 text-2xl font-semibold">{subscription?.plan.name ?? 'No plan'}</p>
          <p className="mt-1 text-xs text-slate-500">
            {subscription?.currentPeriodEnd
              ? `Renews ${formatDate(subscription.currentPeriodEnd)}`
              : 'Subscribe to unlock more devices'}
          </p>
          {!subscription && (
            <Link href="/pricing" className="mt-3 inline-block">
              <Button size="sm">Choose a plan</Button>
            </Link>
          )}
        </Card>
        <Card>
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-500">Active devices</p>
            <Smartphone className="h-4 w-4 text-brand-600" />
          </div>
          <p className="mt-2 text-2xl font-semibold">
            {activeDevices}
            <span className="text-base text-slate-400"> / {maxDevices || '—'}</span>
          </p>
          <p className="mt-1 text-xs text-slate-500">WireGuard tunnels in active use.</p>
        </Card>
        <Card>
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-500">Server locations</p>
            <Server className="h-4 w-4 text-brand-600" />
          </div>
          <p className="mt-2 text-2xl font-semibold">{servers.length}</p>
          <p className="mt-1 text-xs text-slate-500">Online endpoints available now.</p>
        </Card>
      </div>

      <Card>
        <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-lg font-semibold">Your devices</h2>
            <p className="text-sm text-slate-500">
              Generate a new WireGuard config and install it on a device.
            </p>
          </div>
          {canAddDevice && (
            <div className="w-full sm:w-auto">
              <NewDeviceForm
                servers={servers.map((s) => ({
                  id: s.id,
                  name: s.name,
                  location: s.location,
                  premiumOnly: s.premiumOnly,
                }))}
              />
            </div>
          )}
        </div>
        <div className="mt-6">
          {configs.length === 0 ? (
            <p className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500 dark:border-slate-700">
              You haven&apos;t generated any devices yet.
              {subscription ? ' Click "New device" to create your first tunnel.' : ' Subscribe to a plan to add devices.'}
            </p>
          ) : (
            <ConfigList
              configs={configs.map((c) => ({
                id: c.id,
                name: c.name,
                serverName: c.server.name,
                serverLocation: c.server.location,
                address: c.address,
                status: c.status,
                createdAt: c.createdAt.toISOString(),
              }))}
            />
          )}
        </div>
      </Card>
    </div>
  );
}
