'use client';

import { useState } from 'react';
import { RotateCcw, Ban } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useServerAction } from '@/hooks/use-server-action';
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

  const { run: cancel, pending: cancelPending } = useServerAction(cancelSubscriptionAction, {
    successDescription: (fd) =>
      fd.get('immediately') === 'on'
        ? 'Access has been revoked.'
        : `Access continues until ${periodEnd ? formatDate(periodEnd) : 'the end of the period'}.`,
    success: 'Cancellation processed',
    errorTitle: 'Cancellation failed',
    onSuccess: () => setConfirming(false),
  });

  const { run: resume, pending: resumePending } = useServerAction(resumeSubscriptionAction, {
    success: 'Subscription resumed',
    errorTitle: 'Could not resume',
  });

  function submitCancel(immediately: boolean) {
    const fd = new FormData();
    fd.set('subscriptionId', subscriptionId);
    if (immediately) fd.set('immediately', 'on');
    cancel(fd);
  }
  function submitResume() {
    const fd = new FormData();
    fd.set('subscriptionId', subscriptionId);
    resume(fd);
  }

  if (cancelAtPeriodEnd) {
    return (
      <Button variant="outline" type="button" onClick={submitResume} disabled={resumePending}>
        <RotateCcw className="h-4 w-4" /> {resumePending ? 'Resuming…' : 'Resume subscription'}
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
          disabled={cancelPending}
          onClick={() => submitCancel(true)}
        >
          End now
        </Button>
        <Button
          variant="outline"
          size="sm"
          type="button"
          disabled={cancelPending}
          onClick={() => submitCancel(false)}
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
