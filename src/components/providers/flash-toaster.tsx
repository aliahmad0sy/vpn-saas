'use client';

import { useEffect, useRef } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useToast, type ToastTone } from '@/components/ui/toast';

const ALLOWED_TONES = new Set<ToastTone>(['success', 'error', 'info']);
const MESSAGE_MAX = 240;

/**
 * Reads ?toast=<tone>&message=<text> from the URL, emits a toast, then strips
 * those params so back/forward navigation doesn't re-fire. Lets server actions
 * surface feedback after a redirect.
 */
export function FlashToaster() {
  const { toast } = useToast();
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const fired = useRef<string | null>(null);

  useEffect(() => {
    const toneParam = search.get('toast') as ToastTone | null;
    const message = search.get('message');
    if (!toneParam || !ALLOWED_TONES.has(toneParam) || !message) return;

    const key = `${toneParam}:${message}`;
    if (fired.current === key) return;
    fired.current = key;

    toast({ tone: toneParam, description: message.slice(0, MESSAGE_MAX) });

    const params = new URLSearchParams(search.toString());
    params.delete('toast');
    params.delete('message');
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [search, pathname, router, toast]);

  return null;
}
