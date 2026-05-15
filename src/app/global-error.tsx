'use client';

import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Global error:', error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          minHeight: '100vh',
          display: 'grid',
          placeItems: 'center',
          fontFamily: 'system-ui, sans-serif',
          background: '#0b0f1a',
          color: '#e2e8f0',
        }}
      >
        <div style={{ textAlign: 'center', maxWidth: 480, padding: '0 1.5rem' }}>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Application error</h1>
          <p style={{ marginTop: '0.5rem', color: '#94a3b8' }}>
            Something went badly wrong and we couldn&apos;t recover automatically.
          </p>
          <button
            onClick={reset}
            style={{
              marginTop: '1.25rem',
              padding: '0.5rem 1rem',
              borderRadius: '0.5rem',
              background: '#3479ff',
              color: 'white',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
