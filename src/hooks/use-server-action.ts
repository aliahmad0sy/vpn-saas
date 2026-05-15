'use client';

import { useTransition } from 'react';
import { useToast, type ToastTone } from '@/components/ui/toast';

type Options<TArg> = {
  /** Title shown in the success toast. Set to false to suppress. */
  success?: string | false;
  /** Description shown in the success toast (optional). */
  successDescription?: string | ((arg: TArg) => string);
  /** Title shown in the error toast. */
  errorTitle?: string;
  /** Called after a successful run (after the toast fires). */
  onSuccess?: (arg: TArg) => void;
};

/**
 * Tiny wrapper around the call-server-action-from-a-client-component pattern:
 *
 *   const { run, pending } = useServerAction(myAction, { success: 'Saved' });
 *   <button onClick={() => run(formData)} disabled={pending}>Save</button>
 *
 * Captures the success/error toast plumbing so individual components don't
 * each re-implement it.
 */
export function useServerAction<TArg = FormData>(
  action: (arg: TArg) => Promise<unknown>,
  opts: Options<TArg> = {},
) {
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();

  function run(arg: TArg) {
    startTransition(async () => {
      try {
        await action(arg);
        if (opts.success !== false) {
          const description =
            typeof opts.successDescription === 'function'
              ? opts.successDescription(arg)
              : opts.successDescription;
          toast({
            tone: 'success' satisfies ToastTone,
            title: opts.success ?? 'Done',
            description,
          });
        }
        opts.onSuccess?.(arg);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        // Server Action redirects throw NEXT_REDIRECT — that's success, not
        // an error worth showing to the user.
        if (message.includes('NEXT_REDIRECT')) return;
        toast({
          tone: 'error' satisfies ToastTone,
          title: opts.errorTitle ?? 'Something went wrong',
          description: message,
        });
      }
    });
  }

  return { run, pending };
}
