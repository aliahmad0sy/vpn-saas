'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useServerAction } from '@/hooks/use-server-action';
import { updateProfileAction } from '@/server/actions/settings';

export function ProfileForm({ initialName, email }: { initialName: string; email: string }) {
  const { run, pending } = useServerAction(updateProfileAction, {
    success: 'Profile updated',
    errorTitle: 'Could not update profile',
  });

  return (
    <form action={run} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div>
        <label htmlFor="name" className="mb-1.5 block text-sm font-medium">
          Display name
        </label>
        <Input id="name" name="name" defaultValue={initialName} required minLength={2} maxLength={80} />
      </div>
      <div>
        <label className="mb-1.5 block text-sm font-medium text-slate-500">Email</label>
        <Input value={email} disabled readOnly />
      </div>
      <div className="sm:col-span-2">
        <Button type="submit" disabled={pending}>
          {pending ? 'Saving…' : 'Save changes'}
        </Button>
      </div>
    </form>
  );
}
