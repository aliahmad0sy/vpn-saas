import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/server/guards';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { setServerStatusAction, upsertServerAction } from '@/server/actions/admin';

export const metadata = { title: 'Servers' };

export default async function AdminServersPage() {
  await requireAdmin();
  const servers = await prisma.server.findMany({ orderBy: { createdAt: 'desc' } });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Servers</h1>
        <p className="text-sm text-slate-500">Manage VPN endpoints and capacity.</p>
      </div>

      <Card>
        <h2 className="font-semibold">Add a server</h2>
        <p className="text-sm text-slate-500">
          Public key should be the WireGuard server&apos;s base64-encoded public key.
        </p>
        <form
          action={upsertServerAction}
          className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3"
        >
          {[
            { name: 'name', label: 'Name', placeholder: 'US East 2' },
            { name: 'location', label: 'Location', placeholder: 'New York, NY' },
            { name: 'country', label: 'Country (ISO-2)', placeholder: 'US' },
            { name: 'hostname', label: 'Hostname', placeholder: 'us-east-2.vpn.example.com' },
            { name: 'endpoint', label: 'Endpoint', placeholder: 'us-east-2.vpn.example.com:51820' },
            { name: 'publicKey', label: 'Public key', placeholder: 'base64' },
            { name: 'subnetCidr', label: 'Subnet CIDR', placeholder: '10.40.0.0/24' },
          ].map((f) => (
            <div key={f.name}>
              <label className="mb-1 block text-xs font-medium text-slate-500">{f.label}</label>
              <input
                name={f.name}
                placeholder={f.placeholder}
                required
                className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900"
              />
            </div>
          ))}
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="premiumOnly" className="h-4 w-4" />
            Premium-only
          </label>
          <div className="flex items-end">
            <Button type="submit" className="w-full">
              Save server
            </Button>
          </div>
        </form>
      </Card>

      <Card className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500 dark:bg-slate-900">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Hostname</th>
              <th className="px-4 py-3">Subnet</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
            {servers.map((s) => (
              <tr key={s.id}>
                <td className="px-4 py-3 font-medium">
                  {s.name} <span className="text-xs text-slate-500">({s.location})</span>
                </td>
                <td className="px-4 py-3 text-slate-500">{s.hostname}</td>
                <td className="px-4 py-3 text-slate-500">{s.subnetCidr}</td>
                <td className="px-4 py-3">
                  <Badge
                    tone={s.status === 'ONLINE' ? 'success' : s.status === 'MAINTENANCE' ? 'warning' : 'danger'}
                  >
                    {s.status.toLowerCase()}
                  </Badge>
                </td>
                <td className="px-4 py-3">
                  <form action={setServerStatusAction} className="flex items-center gap-2">
                    <input type="hidden" name="serverId" value={s.id} />
                    <select
                      name="status"
                      defaultValue={s.status}
                      className="h-9 rounded-lg border border-slate-300 bg-white px-2 text-sm dark:border-slate-700 dark:bg-slate-900"
                    >
                      <option value="ONLINE">ONLINE</option>
                      <option value="OFFLINE">OFFLINE</option>
                      <option value="MAINTENANCE">MAINTENANCE</option>
                    </select>
                    <Button type="submit" size="sm" variant="outline">
                      Update
                    </Button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
