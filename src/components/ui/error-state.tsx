'use client';

import { AlertTriangle, RefreshCcw } from 'lucide-react';
import { Button } from './button';

export function ErrorState({
  title = 'Something went wrong',
  message,
  onRetry,
}: {
  title?: string;
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="grid min-h-[40vh] place-items-center px-6">
      <div className="max-w-md text-center">
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-300">
          <AlertTriangle className="h-5 w-5" />
        </span>
        <h2 className="mt-4 text-xl font-semibold">{title}</h2>
        {message && <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{message}</p>}
        {onRetry && (
          <div className="mt-5">
            <Button variant="outline" onClick={onRetry}>
              <RefreshCcw className="h-4 w-4" /> Try again
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
