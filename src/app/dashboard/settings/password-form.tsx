'use client';

import { useRef, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/toast';
import { changePasswordAction } from '@/server/actions/settings';

export function PasswordForm() {
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const { toast } = useToast();

  function onSubmit(formData: FormData) {
    startTransition(async () => {
      try {
        await changePasswordAction(formData);
        toast({ tone: 'success', title: 'Password updated' });
        formRef.current?.reset();
      } catch (err) {
        toast({
          tone: 'error',
          title: 'Could not change password',
          description: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    });
  }

  return (
    <form ref={formRef} action={onSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-3">
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
