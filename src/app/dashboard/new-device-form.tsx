'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useServerAction } from '@/hooks/use-server-action';
import { createVpnConfigAction } from '@/server/actions/vpn';

type Server = { id: string; name: string; location: string; premiumOnly: boolean };

export function NewDeviceForm({ servers }: { servers: Server[] }) {
  const [open, setOpen] = useState(false);
  const { run, pending } = useServerAction(createVpnConfigAction, {
    success: 'Device added',
    successDescription: 'Your new tunnel is ready.',
    errorTitle: 'Could not add device',
    onSuccess: () => setOpen(false),
  });

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)} type="button">
        <Plus className="h-4 w-4" /> New device
      </Button>
    );
  }

  return (
    <form
      action={run}
      className="grid w-full grid-cols-1 gap-3 rounded-lg border border-slate-200 p-4 sm:grid-cols-3 dark:border-slate-800"
    >
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-500">Device name</label>
        <input
          name="name"
          required
          maxLength={64}
          placeholder="MacBook Pro"
          className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-500">Server</label>
        <select
          name="serverId"
          required
          className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900"
        >
          {servers.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} — {s.location}
              {s.premiumOnly ? ' (Pro+)' : ''}
            </option>
          ))}
        </select>
      </div>
      <div className="flex items-end gap-2">
        <Button type="submit" disabled={pending} className="flex-1">
          {pending ? 'Generating…' : 'Generate config'}
        </Button>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
