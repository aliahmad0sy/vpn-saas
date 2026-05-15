import * as React from 'react';
import { cn } from '@/lib/utils';

type Tone = 'default' | 'success' | 'warning' | 'danger' | 'info';

const tones: Record<Tone, string> = {
  default: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  success: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  warning: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  danger: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  info: 'bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300',
};

export function Badge({
  tone = 'default',
  className,
  ...rest
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        tones[tone],
        className,
      )}
      {...rest}
    />
  );
}
