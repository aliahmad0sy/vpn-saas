'use client';

import { Suspense } from 'react';
import { ToastProvider } from '@/components/ui/toast';
import { FlashToaster } from './flash-toaster';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <Suspense fallback={null}>
        <FlashToaster />
      </Suspense>
      {children}
    </ToastProvider>
  );
}
