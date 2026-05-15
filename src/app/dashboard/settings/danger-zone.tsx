'use client';

import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useServerAction } from '@/hooks/use-server-action';
import { deleteAccountAction } from '@/server/actions/settings';

export function DangerZone() {
  const [confirming, setConfirming] = useState(false);
  // The action redirects to '/' on success; useServerAction already
  // suppresses NEXT_REDIRECT errors, so no extra handling here.
  const { run, pending } = useServerAction(deleteAccountAction, {
    success: false,
    errorTitle: 'Could not delete account',
  });

  if (!confirming) {
    return (
      <Button variant="danger" type="button" onClick={() => setConfirming(true)}>
        <Trash2 className="h-4 w-4" /> Delete account
      </Button>
    );
  }

  return (
    <form
      action={run}
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
