import type { InvoiceDTO, TransactionDTO, YearMonth } from '@fincontrol/shared';
import { AlertTriangle, CheckCircle2, Clock, CircleSlash, CreditCard, type LucideIcon } from 'lucide-react';
import { useState } from 'react';
import { useParams } from 'react-router';
import { Button } from '../../components/ui/button';
import { PageHeader } from '../../components/ui/page-header';
import { Panel } from '../../components/ui/panel';
import { EmptyState, ErrorState, ListSkeleton, Skeleton } from '../../components/ui/states';
import { cn } from '../../lib/cn';
import { formatBRL, formatDate, formatMonthShort } from '../../lib/format';
import { useAccounts } from '../accounts/api';
import { useCardInvoices, useInvoiceDetail } from './api';
import { PayInvoiceDialog } from './pay-invoice-dialog';

type Status = { label: string; tone: 'neutral' | 'good' | 'warning' | 'critical'; icon: LucideIcon };

// Mesmo vocabulário ícone+tom de health-tiles.tsx e invoice-row.tsx (situação nunca só por cor).
const TONE: Record<Status['tone'], string> = { neutral: 'text-muted', good: 'text-income', warning: 'text-warning', critical: 'text-expense' };

const STATUS: Record<InvoiceDTO['status'], Status> = {
  open: { label: 'Aberta', tone: 'neutral', icon: Clock },
  closed: { label: 'Fechada', tone: 'warning', icon: AlertTriangle },
  paid: { label: 'Paga', tone: 'good', icon: CheckCircle2 },
  overdue: { label: 'Vencida', tone: 'critical', icon: CircleSlash },
};

/** Um lançamento da fatura (compra ou pagamento): descrição (já autoexplicativa, inclusive no pagamento — "Pagamento da fatura dez/2026"), parcela k/N e valor. */
function InvoiceTransactionRow({ tx }: { tx: TransactionDTO }) {
  return (
    <li className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
      <span className="flex min-w-0 items-center gap-2">
        <span className="truncate">{tx.description}</span>
        {tx.installmentNumber != null && tx.installmentTotal != null && (
          <span className="shrink-0 rounded-full bg-surface-2 px-1.5 py-0.5 text-[11px] font-medium text-muted">
            {tx.installmentNumber}/{tx.installmentTotal}
          </span>
        )}
      </span>
      <span className="flex shrink-0 items-center gap-3 text-xs text-muted">
        {formatDate(tx.dueDate)}
        <span className={cn('tabular text-sm font-semibold', tx.type === 'expense' ? 'text-text' : 'text-income')}>{formatBRL(tx.amount)}</span>
      </span>
    </li>
  );
}

/**
 * Os lançamentos da fatura, carregados sob demanda (decisão do controlador: "carregue como achar melhor"):
 * só monta (e só então busca) quando a fatura está expandida — `InvoiceCard` abaixo controla isso.
 */
function InvoiceTransactions({ cardId, month }: { cardId: string; month: YearMonth }) {
  const detail = useInvoiceDetail(cardId, month);
  if (detail.isPending) return <Skeleton className="m-4 h-10" />;
  if (detail.isError) return <ErrorState message={detail.error.message} onRetry={() => detail.refetch()} />;
  if (detail.data.transactions.length === 0) return <p className="px-4 py-3 text-sm text-muted">Sem lançamentos nesta fatura.</p>;
  return <ul className="divide-y divide-border">{detail.data.transactions.map((tx) => <InvoiceTransactionRow key={tx.id} tx={tx} />)}</ul>;
}

type InvoiceCardProps = { cardId: string; invoice: InvoiceDTO; highlight?: boolean; onPay: (invoice: InvoiceDTO) => void };

/**
 * Uma fatura: mês, vencimento, valor, pago, situação com ícone, "Pagar fatura" (quando restante > 0) e os
 * lançamentos (abertos por padrão na fatura em destaque; nas demais, um clique em "Ver lançamentos" carrega).
 */
function InvoiceCard({ cardId, invoice, highlight, onPay }: InvoiceCardProps) {
  const [showTransactions, setShowTransactions] = useState(Boolean(highlight));
  const status = STATUS[invoice.status];
  const remaining = invoice.amount - invoice.paid;

  return (
    <Panel className={cn('p-5', highlight && 'border-primary')}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-display text-lg font-semibold tracking-tight">{formatMonthShort(invoice.month)}</p>
          <p className="text-xs text-muted">Vencimento em {formatDate(invoice.dueDate)}</p>
        </div>
        <span className={cn('inline-flex items-center gap-1.5 text-sm font-medium', TONE[status.tone])}>
          <status.icon aria-hidden className="h-4 w-4" strokeWidth={2} />
          {status.label}
        </span>
      </div>
      <div className="mt-3 flex flex-wrap gap-6 text-sm text-muted">
        <span>
          Valor <span className="tabular font-semibold text-text">{formatBRL(invoice.amount)}</span>
        </span>
        <span>
          Pago <span className="tabular font-semibold text-text">{formatBRL(invoice.paid)}</span>
        </span>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {remaining > 0 && (
          <Button size="sm" variant="secondary" onClick={() => onPay(invoice)}>
            Pagar fatura
          </Button>
        )}
        <Button size="sm" variant="ghost" onClick={() => setShowTransactions((v) => !v)}>
          {showTransactions ? 'Ocultar lançamentos' : 'Ver lançamentos'}
        </Button>
      </div>
      {showTransactions && (
        <div className="mt-3 -mx-5 -mb-5 border-t border-border">
          <InvoiceTransactions cardId={cardId} month={invoice.month} />
        </div>
      )}
    </Panel>
  );
}

export default function InvoicesPage() {
  const { id = '' } = useParams();
  const accounts = useAccounts(true);
  const invoices = useCardInvoices(id);
  const [paying, setPaying] = useState<InvoiceDTO | null>(null);

  const card = accounts.data?.find((a) => a.id === id);
  const openInvoice = invoices.data?.find((i) => i.status === 'open');
  const otherInvoices = (invoices.data ?? []).filter((i) => i.month !== openInvoice?.month);

  return (
    <>
      <PageHeader light="Faturas do" bold={card?.name ?? 'cartão'} />

      {(accounts.isPending || invoices.isPending) && <ListSkeleton />}
      {invoices.isError && <ErrorState message={invoices.error.message} onRetry={() => invoices.refetch()} />}

      {invoices.data && (
        <>
          {card?.card && (
            <Panel className="mb-6 flex flex-wrap gap-6 p-5 text-sm text-muted">
              <span>
                Limite <span className="tabular font-semibold text-text">{formatBRL(card.creditLimit ?? 0)}</span>
              </span>
              <span>
                Usado <span className="tabular font-semibold text-text">{formatBRL((card.creditLimit ?? 0) - card.card.limitAvailable)}</span>
              </span>
              <span>
                Disponível <span className="tabular font-semibold text-text">{formatBRL(card.card.limitAvailable)}</span>
              </span>
            </Panel>
          )}

          {invoices.data.length === 0 && (
            <EmptyState
              icon={<CreditCard className="h-7 w-7" strokeWidth={1.5} />}
              title="Nenhuma fatura ainda"
              description="Faturas aparecem aqui conforme você lança compras no cartão."
            />
          )}

          {openInvoice && (
            <section aria-label="Fatura aberta" className="mb-6">
              <InvoiceCard cardId={id} invoice={openInvoice} highlight onPay={setPaying} />
            </section>
          )}

          {otherInvoices.length > 0 && (
            <section aria-label="Faturas fechadas e histórico">
              <h2 className="mb-3 font-display text-lg font-semibold tracking-tight">Fechadas e histórico</h2>
              <div className="grid gap-4">
                {otherInvoices.map((invoice) => (
                  <InvoiceCard key={invoice.month} cardId={id} invoice={invoice} onPay={setPaying} />
                ))}
              </div>
            </section>
          )}
        </>
      )}

      {paying && (
        <PayInvoiceDialog
          open
          onOpenChange={(o) => !o && setPaying(null)}
          cardId={id}
          month={paying.month}
          remaining={paying.amount - paying.paid}
          paymentAccountId={card?.paymentAccountId ?? null}
          accounts={accounts.data ?? []}
        />
      )}
    </>
  );
}
