'use client';

import { useEffect } from 'react';
import { ErrorState } from '@/components/ui/error-state';

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Dashboard error:', error);
  }, [error]);

  return (
    <ErrorState
      title="We couldn't load your dashboard"
      message={
        process.env.NODE_ENV === 'development'
          ? error.message
          : 'Refresh in a moment — if the issue persists, contact support.'
      }
      onRetry={reset}
    />
  );
}
