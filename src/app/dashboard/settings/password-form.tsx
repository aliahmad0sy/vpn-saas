'use client';

import { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useServerAction } from '@/hooks/use-server-action';
import { changePasswordAction } from '@/server/actions/settings';

export function PasswordForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const { run, pending } = useServerAction(changePasswordAction, {
    success: 'Password updated',
    errorTitle: 'Could not change password',
    onSuccess: () => formRef.current?.reset(),
  });

  return (
    <form ref={formRef} action={run} className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <div>
        <label htmlFor="currentPassword" className="mb-1.5 block text-sm font-medium">
          Current password
        </label>
        <Input
          id="currentPassword"
          name="currentPassword"
          type="password"
          autoComplete="current-password"
          required
        />
      </div>
      <div>
        <label htmlFor="newPassword" className="mb-1.5 block text-sm font-medium">
          New password
        </label>
        <Input
          id="newPassword"
          name="newPassword"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
        />
      </div>
      <div>
        <label htmlFor="confirmPassword" className="mb-1.5 block text-sm font-medium">
          Confirm new password
        </label>
        <Input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
        />
      </div>
      <div className="sm:col-span-3">
        <Button type="submit" disabled={pending}>
          {pending ? 'Updating…' : 'Change password'}
        </Button>
      </div>
    </form>
  );
}
