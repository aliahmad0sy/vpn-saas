'use client';

import { useEffect } from 'react';
import { ErrorState } from '@/components/ui/error-state';

export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Route error:', error);
  }, [error]);

  const friendly =
    process.env.NODE_ENV === 'development'
      ? error.message
      : 'An unexpected error occurred. Please try again.';

  return <ErrorState message={friendly} onRetry={reset} />;
}
