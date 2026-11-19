import { type DebtDTO } from '@fincontrol/shared';
import { ChevronRight, HandCoins, Plus, TrendingDown } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { Button } from '../../components/ui/button';
import { PageHeader } from '../../components/ui/page-header';
import { Panel } from '../../components/ui/panel';
import { EmptyState, ErrorState, Skeleton } from '../../components/ui/states';
import { formatBRL, formatDate } from '../../lib/format';
import { useDebts } from './api';
import { DebtForm } from './debt-form';
import { DEBT_KIND_ICON, DebtProgress, DebtStatusBadge } from './debt-status';

function DebtItem({ debt }: { debt: DebtDTO }) {
  const Icon = DEBT_KIND_ICON[debt.kind];
  const pct = Math.round(debt.fraction * 100);
  return (
    <Panel role="article" aria-label={debt.name} className="flex flex-col gap-4 p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span aria-hidden className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-surface-2 text-muted">
            <Icon className="h-5 w-5" strokeWidth={1.75} />
          </span>
          <div className="min-w-0">
            <p className="truncate font-display text-lg font-semibold tracking-tight">{debt.name}</p>
            <p className="truncate text-sm text-muted">{debt.creditor}</p>
          </div>
        </div>
        <DebtStatusBadge status={debt.status} />
      </div>
      <div className="grid gap-2">
        <div className="flex flex-wrap justify-between gap-2 text-sm">
          <span>
            Saldo <span className="tabular font-semibold">{formatBRL(debt.balance)}</span>
          </span>
          <span className="tabular text-muted">{`${pct}% pago`}</span>
        </div>
        <DebtProgress label={`Quitação de ${debt.name}`} fraction={debt.fraction} status={debt.status} />
      </div>
      <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted">
        {debt.interest > 0 && (
          <span>
            Juros e multas <span className="tabular font-semibold text-text">{formatBRL(debt.interest)}</span>
          </span>
        )}
        {debt.nextDue && (
          <span>
            Próxima parcela <span className="tabular font-semibold text-text">{`${formatBRL(debt.nextDue.amount)} em ${formatDate(debt.nextDue.date)}`}</span>
          </span>
        )}
      </div>
      <Link to={`/dividas/${debt.id}`} className="inline-flex items-center gap-1 self-start text-sm font-medium text-primary hover:underline">
        Ver detalhes
        <ChevronRight aria-hidden className="h-4 w-4" />
      </Link>
    </Panel>
  );
}

function Totals({ debts }: { debts: DebtDTO[] }) {
  const sum = (pick: (d: DebtDTO) => number) => debts.reduce((s, d) => s + pick(d), 0);
  const items: [string, number][] = [
    ['Você deve', sum((d) => d.balance)],
    ['Já pagou', sum((d) => d.paid)],
    ['Juros e multas', sum((d) => d.interest)],
    ['Descontos', sum((d) => d.discounts)],
  ];
  return (
    <Panel role="group" aria-label="Resumo das dívidas" className="grid grid-cols-2 gap-5 p-5 sm:grid-cols-4">
      {items.map(([label, value]) => (
        <div key={label} className="grid min-w-0 gap-1">
          <span className="text-xs text-muted">{label}</span>
          <span className="tabular truncate font-display text-lg font-semibold">{formatBRL(value)}</span>
        </div>
      ))}
    </Panel>
  );
}

export default function DebtsPage() {
  const debts = useDebts();
  const [creating, setCreating] = useState(false);

  const newButton = (
    <Button onClick={() => setCreating(true)}>
      <Plus aria-hidden className="h-4 w-4" strokeWidth={2} />
      Nova dívida
    </Button>
  );
  const actions = (
    <div className="flex flex-wrap gap-2">
      {newButton}
      <Link
        to="/dividas/plano"
        className="inline-flex h-11 items-center gap-2 rounded-full border border-border px-5 text-sm font-medium hover:border-muted"
      >
        <TrendingDown aria-hidden className="h-4 w-4" strokeWidth={1.75} />
        Plano de quitação
      </Link>
    </div>
  );

  return (
    <>
      <PageHeader
        light="Suas"
        bold="dívidas"
        description="Dívidas com lojas, pessoas, contas atrasadas e outros credores: negociações, acordos e quanto falta para quitar."
        actions={actions}
      />

      {debts.isPending && (
        <div className="grid gap-4 md:grid-cols-2">
          {[0, 1].map((i) => (
            <Skeleton key={i} className="h-48 rounded-[var(--radius-panel)]" />
          ))}
        </div>
      )}
      {debts.isError && <ErrorState message={debts.error.message} onRetry={() => debts.refetch()} />}
      {debts.data && debts.data.length === 0 && (
        <EmptyState
          icon={<HandCoins className="h-7 w-7" strokeWidth={1.5} />}
          title="Nenhuma dívida cadastrada"
          description="Cadastre o que você deve fora do cartão e dos empréstimos: crediário, conta atrasada, imposto ou dinheiro emprestado de alguém."
          action={newButton}
        />
      )}
      {debts.data && debts.data.length > 0 && (
        <div className="grid grid-cols-1 gap-6">
          <Totals debts={debts.data} />
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {debts.data.map((d) => (
              <DebtItem key={d.id} debt={d} />
            ))}
          </div>
        </div>
      )}

      {creating && <DebtForm open onOpenChange={setCreating} />}
    </>
  );
}
