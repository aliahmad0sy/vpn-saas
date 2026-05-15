'use client';

import { useState, useTransition } from 'react';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/toast';
import { deleteAccountAction } from '@/server/actions/settings';

export function DangerZone() {
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();
  const { toast } = useToast();

  function onSubmit(formData: FormData) {
    startTransition(async () => {
      try {
        // deleteAccountAction signs out and redirects on success, so this
        // promise typically rejects with NEXT_REDIRECT — that's expected.
        await deleteAccountAction(formData);
      } catch (err) {
        const message = err instanceof Error ? err.message : '';
        // Don't surface Next.js redirect throws to the user.
        if (message.includes('NEXT_REDIRECT')) return;
        toast({
          tone: 'error',
          title: 'Could not delete account',
          description: message || 'Unknown error',
        });
      }
    });
  }

  if (!confirming) {
    return (
      <Button variant="danger" type="button" onClick={() => setConfirming(true)}>
        <Trash2 className="h-4 w-4" /> Delete account
      </Button>
    );
  }

  return (
    <form
      action={onSubmit}
      className="space-y-3 rounded-lg border border-red-200 bg-red-50/60 p-4 dark:border-red-900/60 dark:bg-red-950/30"
    >
      <p className="text-sm text-red-800 dark:text-red-200">
        Type <span className="font-mono font-semibold">delete my account</span> to confirm.
      </p>
      <Input
        name="confirm"
        placeholder="delete my account"
        required
        autoComplete="off"
        spellCheck={false}
      />
      <div className="flex gap-2">
        <Button variant="danger" type="submit" disabled={pending}>
          {pending ? 'Deleting…' : 'Permanently delete'}
        </Button>
        <Button
          variant="ghost"
          type="button"
          onClick={() => setConfirming(false)}
          disabled={pending}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
