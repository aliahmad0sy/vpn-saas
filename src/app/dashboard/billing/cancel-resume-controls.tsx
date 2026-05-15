'use client';

import { useState, useTransition } from 'react';
import { RotateCcw, Ban } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import {
  cancelSubscriptionAction,
  resumeSubscriptionAction,
} from '@/server/actions/billing';
import { formatDate } from '@/lib/utils';

export function CancelResumeControls({
  subscriptionId,
  cancelAtPeriodEnd,
  periodEnd,
}: {
  subscriptionId: string;
  cancelAtPeriodEnd: boolean;
  periodEnd: string | null;
}) {
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();
  const { toast } = useToast();

  function callCancel(immediately: boolean) {
    const fd = new FormData();
    fd.set('subscriptionId', subscriptionId);
    if (immediately) fd.set('immediately', 'on');
    startTransition(async () => {
      try {
        await cancelSubscriptionAction(fd);
        toast({
          tone: 'success',
          title: immediately ? 'Subscription canceled' : 'Cancellation scheduled',
          description: immediately
            ? 'Access has been revoked.'
            : `Access continues until ${periodEnd ? formatDate(periodEnd) : 'the end of the period'}.`,
        });
        setConfirming(false);
      } catch (err) {
        toast({
          tone: 'error',
          title: 'Cancellation failed',
          description: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    });
  }

  function callResume() {
    const fd = new FormData();
    fd.set('subscriptionId', subscriptionId);
    startTransition(async () => {
      try {
        await resumeSubscriptionAction(fd);
        toast({ tone: 'success', title: 'Subscription resumed' });
      } catch (err) {
        toast({
          tone: 'error',
          title: 'Could not resume',
          description: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    });
  }

  if (cancelAtPeriodEnd) {
    return (
      <Button variant="outline" type="button" onClick={callResume} disabled={pending}>
        <RotateCcw className="h-4 w-4" /> {pending ? 'Resuming…' : 'Resume subscription'}
      </Button>
    );
  }

  if (!confirming) {
    return (
      <Button variant="outline" type="button" onClick={() => setConfirming(true)}>
        <Ban className="h-4 w-4" /> Cancel
      </Button>
    );
  }

  return (
    <div className="flex flex-col items-end gap-2 rounded-xl border border-red-200 bg-red-50/50 p-3 dark:border-red-900/60 dark:bg-red-950/20">
      <p className="text-xs text-red-800 dark:text-red-200">
        Cancel at end of period (keeps access until {periodEnd ? formatDate(periodEnd) : 'period end'}),
        or end access immediately?
      </p>
      <div className="flex gap-2">
        <Button
          variant="danger"
          size="sm"
          type="button"
          disabled={pending}
          onClick={() => callCancel(true)}
        >
          End now
        </Button>
        <Button
          variant="outline"
          size="sm"
          type="button"
          disabled={pending}
          onClick={() => callCancel(false)}
        >
          At period end
        </Button>
        <Button variant="ghost" size="sm" type="button" onClick={() => setConfirming(false)}>
          Keep
        </Button>
      </div>
    </div>
  );
}
