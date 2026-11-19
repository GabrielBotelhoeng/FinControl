import { DEBT_STATUS_LABELS, type DebtKind, type DebtStatus } from '@fincontrol/shared';
import {
  AlertTriangle, Building2, CheckCircle2, CircleDot, Handshake, Landmark, ReceiptText, Store, UserRound, Zap, type LucideIcon,
} from 'lucide-react';
import { cn } from '../../lib/cn';

/** Situação da dívida (V9): ícone e cor seguem o padrão das metas. */
export const DEBT_STATUS_STYLE: Record<DebtStatus, { icon: LucideIcon; tone: string; bar: string }> = {
  open: { icon: CircleDot, tone: 'text-warning', bar: 'bg-primary' },
  agreement: { icon: Handshake, tone: 'text-primary', bar: 'bg-primary' },
  late: { icon: AlertTriangle, tone: 'text-expense', bar: 'bg-expense' },
  paid_off: { icon: CheckCircle2, tone: 'text-income', bar: 'bg-income' },
};

/** Ícone do tipo de credor (V2). */
export const DEBT_KIND_ICON: Record<DebtKind, LucideIcon> = {
  bank: Landmark,
  store: Store,
  utility: Zap,
  tax: ReceiptText,
  person: UserRound,
  other: Building2,
};

export function DebtStatusBadge({ status, className }: { status: DebtStatus; className?: string }) {
  const s = DEBT_STATUS_STYLE[status];
  return (
    <span className={cn('inline-flex shrink-0 items-center gap-1.5 text-sm font-medium', s.tone, className)}>
      <s.icon aria-hidden className="h-4 w-4" strokeWidth={2} />
      {DEBT_STATUS_LABELS[status]}
    </span>
  );
}

export function DebtProgress({ label, fraction, status }: { label: string; fraction: number; status: DebtStatus }) {
  const pct = Math.round(fraction * 100);
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
      className="h-2 overflow-hidden rounded-full bg-surface-2"
    >
      <div className={cn('h-full rounded-full', DEBT_STATUS_STYLE[status].bar)} style={{ width: `${pct}%` }} />
    </div>
  );
}
