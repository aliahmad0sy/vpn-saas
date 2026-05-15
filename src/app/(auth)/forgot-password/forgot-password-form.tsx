'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useServerAction } from '@/hooks/use-server-action';
import { requestPasswordResetAction } from '@/server/actions/password-reset';

export function ForgotPasswordForm() {
  // requestPasswordResetAction redirects to /forgot-password?sent=1 in every
  // outcome (success, validation error, rate-limit, unknown account) to
  // avoid leaking account existence. The useServerAction hook swallows
  // NEXT_REDIRECT, so the only visible failure path here is a network error.
  const { run, pending } = useServerAction(requestPasswordResetAction, {
    success: false,
    errorTitle: "Couldn't send reset email",
  });

  return (
    <form action={run} className="space-y-4">
      <div>
        <label htmlFor="email" className="mb-1.5 block text-sm font-medium">
          Email
        </label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          autoFocus
          maxLength={320}
        />
      </div>
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? 'Sending…' : 'Send reset link'}
      </Button>
    </form>
  );
}
