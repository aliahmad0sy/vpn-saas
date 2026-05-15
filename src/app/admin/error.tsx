'use client';

import { useEffect } from 'react';
import { ErrorState } from '@/components/ui/error-state';

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Admin error:', error);
  }, [error]);

  return (
    <ErrorState
      title="Admin panel hit an error"
      message={
        process.env.NODE_ENV === 'development'
          ? error.message
          : 'Try again. If this keeps happening, check the server logs.'
      }
      onRetry={reset}
    />
  );
}
