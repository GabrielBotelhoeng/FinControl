import { monthOf, todayInSaoPaulo, type BudgetCategoryDTO, type BudgetItemDTO, type BudgetStatus, type YearMonth } from '@fincontrol/shared';
import { AlertTriangle, CheckCircle2, CircleSlash, type LucideIcon } from 'lucide-react';
import { useState } from 'react';
import { Button } from '../../components/ui/button';
import { MonthPicker } from '../../components/ui/month-picker';
import { Panel } from '../../components/ui/panel';
import { ErrorState, ListSkeleton } from '../../components/ui/states';
import { cn } from '../../lib/cn';
import { formatBRL } from '../../lib/format';
import { iconFor } from '../categories/icons';
import { useBudgetMonth } from './api';
import { BudgetForm } from './budget-form';
import { Forecast } from './forecast';

/** Situação sempre com ícone e texto (P3). */
export const BUDGET_STATUS: Record<BudgetStatus, { label: string; icon: LucideIcon; tone: string; bar: string }> = {
  ok: { label: 'Dentro do limite', icon: CheckCircle2, tone: 'text-income', bar: 'bg-income' },
  near: { label: 'Perto do limite', icon: AlertTriangle, tone: 'text-warning', bar: 'bg-warning' },
  over: { label: 'Estourou', icon: CircleSlash, tone: 'text-expense', bar: 'bg-expense' },
};

function BudgetItem({ item, onEdit }: { item: BudgetItemDTO; onEdit: () => void }) {
  const status = BUDGET_STATUS[item.status];
  const Icon = iconFor(item.icon);
  return (
    <Panel role="article" aria-label={item.name} className="grid gap-3 p-5">
      <div className="flex items-center justify-between gap-3">
        <span className="inline-flex min-w-0 items-center gap-2 font-semibold">
          <Icon aria-hidden className="h-4 w-4 shrink-0" style={{ color: item.color }} strokeWidth={1.75} />
          <span className="truncate">{item.name}</span>
        </span>
        <Button size="sm" variant="ghost" onClick={onEdit}>
          Editar
        </Button>
      </div>
      <div
        role="progressbar"
        aria-label={`Comprometido de ${item.name}`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={item.percent}
        className="h-2 overflow-hidden rounded-full bg-surface-2"
      >
        <div className={cn('h-full rounded-full', status.bar)} style={{ width: `${Math.min(item.percent, 100)}%` }} />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <span className="tabular">{`${formatBRL(item.committed)} de ${formatBRL(item.limit)}`}</span>
        <span className={cn('inline-flex items-center gap-1.5 font-medium', status.tone)}>
          <status.icon aria-hidden className="h-4 w-4" strokeWidth={2} />
          {`${status.label} (${item.percent}%)`}
        </span>
      </div>
      {item.pending > 0 && <p className="text-xs text-muted">{`Inclui ${formatBRL(item.pending)} ainda a pagar neste mês.`}</p>}
    </Panel>
  );
}

function NoBudgetItem({ category, onSet }: { category: BudgetCategoryDTO; onSet: () => void }) {
  const Icon = iconFor(category.icon);
  return (
    <Panel role="article" aria-label={category.name} className="flex items-center justify-between gap-3 p-4">
      <span className="inline-flex min-w-0 items-center gap-2 text-sm">
        <Icon aria-hidden className="h-4 w-4 shrink-0" style={{ color: category.color }} strokeWidth={1.75} />
        <span className="truncate">{category.name}</span>
      </span>
      <Button size="sm" variant="secondary" onClick={onSet}>
        Definir limite
      </Button>
    </Panel>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="grid gap-1">
      <span className="text-xs text-muted">{label}</span>
      <span className={cn('tabular font-display text-base font-semibold sm:text-lg', tone)}>{value}</span>
    </div>
  );
}

type Editing = { category: BudgetCategoryDTO; current?: number };

export function BudgetTab() {
  const [month, setMonth] = useState<YearMonth>(monthOf(todayInSaoPaulo()));
  const budget = useBudgetMonth(month);
  const [editing, setEditing] = useState<Editing | null>(null);
  const b = budget.data;

  return (
    // grid-cols-1 = minmax(0, 1fr): a coluna encolhe até a tela, e nada força largura maior que 360 px.
    <div className="grid min-w-0 grid-cols-1 gap-6">
      <div className="justify-self-start">
        <MonthPicker value={month} onChange={setMonth} />
      </div>
      {budget.isPending && <ListSkeleton />}
      {budget.isError && <ErrorState message={budget.error.message} onRetry={() => budget.refetch()} />}
      {b && (
        <>
          <Panel role="group" aria-label="Resumo do mês" className="grid grid-cols-2 gap-4 p-4 sm:grid-cols-4 sm:gap-5 sm:p-5">
            <Stat label="Receitas do mês" value={formatBRL(b.income.paid + b.income.pending)} />
            <Stat label="Orçamento total" value={formatBRL(b.totals.limit)} />
            <Stat label="Comprometido" value={formatBRL(b.totals.committed)} />
            <Stat
              label="Sobra planejada"
              value={`${b.plannedLeftover < 0 ? '−' : ''}${formatBRL(Math.abs(b.plannedLeftover))}`}
              tone={b.plannedLeftover < 0 ? 'text-expense' : 'text-income'}
            />
          </Panel>

          {b.items.length > 0 && (
            <section aria-label="Categorias com limite" className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {b.items.map((item) => (
                <BudgetItem key={item.categoryId} item={item} onEdit={() => setEditing({ category: item, current: item.limit })} />
              ))}
            </section>
          )}

          {b.categoriesWithoutBudget.length > 0 && (
            <section aria-label="Categorias sem limite" className="grid grid-cols-1 gap-3">
              <h2 className="font-display text-lg font-semibold tracking-tight">Sem limite</h2>
              <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                {b.categoriesWithoutBudget.map((c) => (
                  <NoBudgetItem key={c.categoryId} category={c} onSet={() => setEditing({ category: c })} />
                ))}
              </div>
            </section>
          )}
        </>
      )}

      <Forecast />

      {editing && <BudgetForm category={editing.category} {...(editing.current !== undefined ? { current: editing.current } : {})} onOpenChange={(o) => !o && setEditing(null)} />}
    </div>
  );
}
