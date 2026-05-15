'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useServerAction } from '@/hooks/use-server-action';
import { resetPasswordAction } from '@/server/actions/password-reset';

export function ResetPasswordForm({ token }: { token: string }) {
  // On success the action redirects to /login with a flash-toast — there's
  // no inline success state to show, so suppress the local success toast.
  const { run, pending } = useServerAction(resetPasswordAction, {
    success: false,
    errorTitle: "Couldn't reset password",
  });

  return (
    <form action={run} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      <div>
        <label htmlFor="password" className="mb-1.5 block text-sm font-medium">
          New password
        </label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          maxLength={128}
          required
          autoFocus
        />
      </div>
      <div>
        <label htmlFor="confirm" className="mb-1.5 block text-sm font-medium">
          Confirm new password
        </label>
        <Input
          id="confirm"
          name="confirm"
          type="password"
          autoComplete="new-password"
          minLength={8}
          maxLength={128}
          required
        />
      </div>
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? 'Saving…' : 'Update password'}
      </Button>
    </form>
  );
}
