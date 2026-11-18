import { DEBT_KIND_LABELS, type DebtDetailDTO, type DebtTimelineItemDTO } from '@fincontrol/shared';
import { Banknote, Handshake, MessageSquareText, Pencil, RefreshCw, Trash2, TrendingDown, TrendingUp, XCircle, type LucideIcon } from 'lucide-react';
import { useState } from 'react';
import { useParams } from 'react-router';
import { Button } from '../../components/ui/button';
import { PageHeader } from '../../components/ui/page-header';
import { Panel } from '../../components/ui/panel';
import { ErrorState, ListSkeleton } from '../../components/ui/states';
import { cn } from '../../lib/cn';
import { formatBRL, formatDate } from '../../lib/format';
import { useDebt } from './api';
import {
  AgreementDialog, CancelAgreementDialog, DeleteDebtDialog, EditDebtDialog, NoteDialog, PaymentDialog, ValuationDialog,
} from './debt-dialogs';
import { DebtProgress, DebtStatusBadge } from './debt-status';

type DialogKind = 'edit' | 'delete' | 'valuation' | 'note' | 'agreement' | 'cancel' | 'payment';

function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="grid min-w-0 gap-1">
      <span className="text-xs text-muted">{label}</span>
      <span className={cn('tabular truncate font-display text-lg font-semibold', tone)}>{value}</span>
    </div>
  );
}

function timelineEntry(item: DebtTimelineItemDTO): { icon: LucideIcon; title: string; detail: string | null } {
  switch (item.kind) {
    case 'valuation':
      if (item.delta === null) return { icon: Banknote, title: `Dívida de ${formatBRL(item.amount)}`, detail: item.note };
      return {
        icon: item.delta >= 0 ? TrendingUp : TrendingDown,
        title: `Valor atualizado para ${formatBRL(item.amount)}`,
        detail: [item.delta > 0 ? `${formatBRL(item.delta)} de juros e multas` : item.delta < 0 ? `${formatBRL(-item.delta)} de desconto` : null, item.note]
          .filter(Boolean)
          .join(' · ') || null,
      };
    case 'agreement':
      return {
        icon: item.cancelledAt ? XCircle : Handshake,
        title: `Acordo de ${formatBRL(item.amount)}${item.cancelledAt ? ' (cancelado)' : ''}`,
        detail: [
          item.downPayment > 0 ? `Entrada de ${formatBRL(item.downPayment)}` : null,
          `${item.installments}x de ${formatBRL(item.installmentAmount)}`,
          item.delta < 0 ? `${formatBRL(-item.delta)} de desconto` : null,
        ]
          .filter(Boolean)
          .join(' · '),
      };
    case 'note':
      return { icon: MessageSquareText, title: 'Negociação', detail: [item.text, item.amount ? `Proposta de ${formatBRL(item.amount)}` : null].filter(Boolean).join(' · ') };
    case 'payment':
      return { icon: Banknote, title: `Pagamento de ${formatBRL(item.amount)}`, detail: item.description };
  }
}

function Timeline({ items }: { items: DebtTimelineItemDTO[] }) {
  return (
    <Panel role="region" aria-label="Histórico" className="grid gap-4 p-5">
      <h2 className="font-display text-lg font-semibold tracking-tight">Histórico</h2>
      <ol className="grid gap-4">
        {items.map((item) => {
          const e = timelineEntry(item);
          return (
            <li key={`${item.kind}-${item.id}`} className="flex gap-3">
              <span aria-hidden className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-surface-2 text-muted">
                <e.icon className="h-4 w-4" strokeWidth={1.75} />
              </span>
              <div className="grid min-w-0 gap-0.5">
                <p className="text-sm font-medium">{e.title}</p>
                {e.detail && <p className="break-words text-sm text-muted">{e.detail}</p>}
                <p className="text-xs text-muted">{formatDate(item.date)}</p>
              </div>
            </li>
          );
        })}
      </ol>
    </Panel>
  );
}

function AgreementPanel({ agreement }: { agreement: NonNullable<DebtDetailDTO['agreement']> }) {
  return (
    <Panel role="region" aria-label="Acordo" className="grid gap-4 p-5">
      <div className="grid gap-1">
        <h2 className="font-display text-lg font-semibold tracking-tight">Acordo</h2>
        <p className="text-sm text-muted">
          {`Fechado em ${formatDate(agreement.date)}: ${agreement.downPayment > 0 ? `entrada de ${formatBRL(agreement.downPayment)} e ` : ''}${agreement.installments}x de ${formatBRL(agreement.installmentAmount)}. Pague as parcelas em Lançamentos.`}
        </p>
      </div>
      <ul className="grid gap-2">
        {agreement.schedule.map((s) => (
          <li key={s.transactionId} className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <span>{`${s.number}ª parcela · ${formatDate(s.dueDate)}`}</span>
            <span className={cn('tabular font-medium', s.paidDate ? 'text-income' : s.overdue ? 'text-expense' : 'text-muted')}>
              {`${formatBRL(s.amount)} · ${s.paidDate ? 'paga' : s.overdue ? 'vencida' : 'a pagar'}`}
            </span>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

/** Uma instância por dívida (`key` = id da rota), como no empréstimo: um diálogo aberto não muda de dívida. */
export default function DebtDetailPage() {
  const { id = '' } = useParams();
  return <DebtDetail key={id} id={id} />;
}

function DebtDetail({ id }: { id: string }) {
  const [deleting, setDeleting] = useState(false);
  const debt = useDebt(id, !deleting);
  const [dialog, setDialog] = useState<DialogKind | null>(null);
  const d = debt.data;
  const close = () => setDialog(null);
  const open = d && d.status !== 'paid_off';
  const inAgreement = d?.agreement != null;

  return (
    <>
      <PageHeader
        light=""
        bold={d?.name ?? 'Dívida'}
        {...(d ? { description: `${DEBT_KIND_LABELS[d.kind]} · ${d.creditor} · desde ${formatDate(d.since)}` } : {})}
        actions={
          d && (
            <>
              <Button variant="secondary" onClick={() => setDialog('edit')}>
                <Pencil aria-hidden className="h-4 w-4" strokeWidth={1.75} />
                Editar
              </Button>
              <Button variant="ghost" className="text-expense" onClick={() => setDialog('delete')}>
                <Trash2 aria-hidden className="h-4 w-4" strokeWidth={1.75} />
                Excluir dívida
              </Button>
            </>
          )
        }
      />

      {debt.isPending && <ListSkeleton />}
      {debt.isError && <ErrorState message={debt.error.message} onRetry={() => debt.refetch()} />}

      {d && (
        <div className="grid grid-cols-1 gap-6">
          <div className="aurora grid gap-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="tabular font-display text-2xl font-semibold tracking-tight">{`Saldo ${formatBRL(d.balance)}`}</p>
              <DebtStatusBadge status={d.status} />
            </div>
            <DebtProgress label={`Quitação de ${d.name}`} fraction={d.fraction} status={d.status} />
            <p className="text-sm text-muted">{`${Math.round(d.fraction * 100)}% pago`}</p>
          </div>

          <Panel role="group" aria-label="Números da dívida" className="grid grid-cols-2 gap-5 p-5 sm:grid-cols-5">
            <Stat label="Valor original" value={formatBRL(d.original)} />
            <Stat label="Juros e multas" value={formatBRL(d.interest)} tone={d.interest > 0 ? 'text-expense' : undefined} />
            <Stat label="Descontos" value={formatBRL(d.discounts)} tone={d.discounts > 0 ? 'text-income' : undefined} />
            <Stat label="Pago" value={formatBRL(d.paid)} />
            <Stat label="Falta pagar" value={formatBRL(d.balance)} />
          </Panel>

          <div className="flex flex-wrap gap-2">
            {open && !inAgreement && (
              <>
                <Button onClick={() => setDialog('payment')}>
                  <Banknote aria-hidden className="h-4 w-4" strokeWidth={1.75} />
                  Registrar pagamento
                </Button>
                <Button variant="secondary" onClick={() => setDialog('agreement')}>
                  <Handshake aria-hidden className="h-4 w-4" strokeWidth={1.75} />
                  Fechar acordo
                </Button>
              </>
            )}
            {!inAgreement && (
              <Button variant="secondary" onClick={() => setDialog('valuation')}>
                <RefreshCw aria-hidden className="h-4 w-4" strokeWidth={1.75} />
                Atualizar valor
              </Button>
            )}
            <Button variant="secondary" onClick={() => setDialog('note')}>
              <MessageSquareText aria-hidden className="h-4 w-4" strokeWidth={1.75} />
              Registrar negociação
            </Button>
            {inAgreement && (
              <Button variant="ghost" className="text-expense" onClick={() => setDialog('cancel')}>
                <XCircle aria-hidden className="h-4 w-4" strokeWidth={1.75} />
                Cancelar acordo
              </Button>
            )}
          </div>

          <div className={cn('grid grid-cols-1 gap-6', d.agreement && 'md:grid-cols-2')}>
            {d.agreement && <AgreementPanel agreement={d.agreement} />}
            <Timeline items={d.timeline} />
          </div>
        </div>
      )}

      {d && dialog === 'edit' && <EditDebtDialog debt={d} onClose={close} />}
      {d && dialog === 'delete' && <DeleteDebtDialog debt={d} onClose={close} onDeleting={setDeleting} />}
      {d && dialog === 'valuation' && <ValuationDialog debt={d} onClose={close} />}
      {d && dialog === 'note' && <NoteDialog debt={d} onClose={close} />}
      {d && dialog === 'agreement' && <AgreementDialog debt={d} onClose={close} />}
      {d && dialog === 'cancel' && <CancelAgreementDialog debt={d} onClose={close} />}
      {d && dialog === 'payment' && <PaymentDialog debt={d} onClose={close} />}
    </>
  );
}
