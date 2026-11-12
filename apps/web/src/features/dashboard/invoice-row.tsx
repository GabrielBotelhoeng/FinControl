import type { UpcomingInvoiceDTO } from '@fincontrol/shared';
import { AlertTriangle, CircleSlash, CreditCard, type LucideIcon } from 'lucide-react';
import { formatBRL, formatDate, formatMonthLabel } from '../../lib/format';

type Status = { label: string; tone: 'warning' | 'critical'; icon: LucideIcon };

// Mesmo vocabulário ícone+tom de health-tiles.tsx (status nunca só por cor).
const TONE: Record<Status['tone'], string> = { warning: 'text-warning', critical: 'text-expense' };

function invoiceStatus(overdue: boolean): Status {
  return overdue ? { label: 'Vencida', tone: 'critical', icon: CircleSlash } : { label: 'Fechada', tone: 'warning', icon: AlertTriangle };
}

/**
 * Item de fatura em "A pagar" (decisão R16): ícone de cartão, "Fatura do <cartão> · <mês>", vencimento, valor
 * restante e a situação com ícone — "Vencida" ou "Fechada". Sem link por enquanto (entra na Tarefa 11).
 * `overdue` vem de quem chama (compara `dueDate` com "hoje"): o DTO não traz a situação, só os valores (R16).
 */
export function InvoiceRow({ item, overdue }: { item: UpcomingInvoiceDTO; overdue: boolean }) {
  const status = invoiceStatus(overdue);
  const title = `Fatura do ${item.cardName} · ${formatMonthLabel(item.month)}`;
  return (
    <li aria-label={title} className="flex items-center gap-3 px-4 py-3 sm:gap-4 sm:px-5">
      <span
        className="grid h-10 w-10 shrink-0 place-items-center rounded-full"
        style={{ backgroundColor: 'color-mix(in srgb, var(--primary) 16%, transparent)', color: 'var(--primary)' }}
      >
        <CreditCard aria-hidden className="h-[18px] w-[18px]" strokeWidth={1.75} />
      </span>
      <div className="min-w-0 flex-1">
        <span className="block truncate font-medium">{title}</span>
        <span className="flex items-center gap-2 text-xs text-muted">
          <span>Vencimento em {formatDate(item.dueDate)}</span>
          <span className={`inline-flex items-center gap-1 font-medium ${TONE[status.tone]}`}>
            <status.icon aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
            {status.label}
          </span>
        </span>
      </div>
      <span className="tabular font-semibold text-expense">{formatBRL(item.remaining)}</span>
    </li>
  );
}
