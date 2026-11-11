import type { HTMLAttributes } from 'react';
import { cn } from '../../lib/cn';

/** Superfície elevada: raio de painel, borda e luz interna (DESIGN.md). Nunca aninhar. */
export function Panel({ className, ...props }: HTMLAttributes<HTMLElement>) {
  return <section className={cn('rounded-[var(--radius-panel)] border border-border bg-surface shadow-panel', className)} {...props} />;
}
