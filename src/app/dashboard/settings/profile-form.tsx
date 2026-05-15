'use client';

import { useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/toast';
import { updateProfileAction } from '@/server/actions/settings';

export function ProfileForm({ initialName, email }: { initialName: string; email: string }) {
  const [pending, startTransition] = useTransition();
  const { toast } = useToast();

  function onSubmit(formData: FormData) {
    startTransition(async () => {
      try {
        await updateProfileAction(formData);
        toast({ tone: 'success', title: 'Profile updated' });
      } catch (err) {
        toast({
          tone: 'error',
          title: 'Could not update profile',
          description: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    });
  }

  return (
    <form action={onSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
