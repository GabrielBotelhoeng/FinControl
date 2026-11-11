import { CloudOff } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';
import { Button } from './button';

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn('animate-pulse rounded-[var(--radius-control)] bg-surface-2', className)} />;
}

export function ListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div role="status" aria-label="Carregando" className="grid gap-3">
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-14" />
      ))}
    </div>
  );
}

export function EmptyState({ title, description, action, icon }: { title: string; description: string; action?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-3 py-10">
      {icon && <div className="text-primary">{icon}</div>}
      <h2 className="font-display text-xl font-semibold tracking-tight">{title}</h2>
      <p className="max-w-[48ch] text-sm text-muted">{description}</p>
      {action && <div className="pt-2">{action}</div>}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-start gap-3 py-10">
      <CloudOff aria-hidden className="h-6 w-6 text-expense" strokeWidth={1.75} />
      <p className="max-w-[48ch] text-sm text-text">{message}</p>
      <Button variant="secondary" size="sm" onClick={onRetry}>
        Tentar de novo
      </Button>
    </div>
  );
}
