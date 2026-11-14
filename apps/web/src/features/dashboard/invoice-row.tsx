import type { UpcomingInvoiceDTO } from '@fincontrol/shared';
import { AlertTriangle, CircleSlash, CreditCard, type LucideIcon } from 'lucide-react';
import { Link } from 'react-router';
import { formatBRL, formatDate, formatMonthLabel } from '../../lib/format';

type Status = { label: string; tone: 'warning' | 'critical'; icon: LucideIcon };

// Mesmo vocabulário ícone+tom de health-tiles.tsx (status nunca só por cor).
const TONE: Record<Status['tone'], string> = { warning: 'text-warning', critical: 'text-expense' };

const STATUS: Record<UpcomingInvoiceDTO['status'], Status> = {
  overdue: { label: 'Vencida', tone: 'critical', icon: CircleSlash },
  closed: { label: 'Fechada', tone: 'warning', icon: AlertTriangle },
};

/**
 * Item de fatura em "A pagar" (decisão R16): ícone de cartão, "Fatura do <cartão> · <mês>", vencimento, valor
 * restante, a situação com ícone — "Vencida" ou "Fechada" — e o link "Ver fatura" para a página de faturas
 * do cartão (Tarefa 11). A situação vem de `item.status`, calculado pelo servidor (spec C4, `invoiceStatus`)
 * — fonte única; a web não recalcula comparando `dueDate` com "hoje" (decisão R26).
 */
export function InvoiceRow({ item }: { item: UpcomingInvoiceDTO }) {
  const status = STATUS[item.status];
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
      <div className="flex shrink-0 flex-col items-end gap-1">
        <span className="tabular font-semibold text-expense">{formatBRL(item.remaining)}</span>
        <Link to={`/cartoes/${item.cardId}`} className="text-xs font-medium text-primary hover:underline">
          Ver fatura
        </Link>
      </div>
    </li>
  );
}
