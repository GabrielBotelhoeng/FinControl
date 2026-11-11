import { monthOf, todayInSaoPaulo, type MonthComparison, type TransactionDTO, type YearMonth } from '@fincontrol/shared';
import { ArrowDownRight, ArrowUpRight, CircleCheck, PieChart, Plus } from 'lucide-react';
import { useState } from 'react';
import { Button } from '../../components/ui/button';
import { HeroAmount } from '../../components/ui/money';
import { MonthPicker } from '../../components/ui/month-picker';
import { Panel } from '../../components/ui/panel';
import { EmptyState, ErrorState, Skeleton } from '../../components/ui/states';
import { formatBRL, formatMonthLabel } from '../../lib/format';
import { useAccounts } from '../accounts/api';
import { useCategories } from '../categories/api';
import { TransactionForm } from '../transactions/transaction-form';
import { TransactionRow } from '../transactions/transaction-row';
import { useByCategory, useEvolution, useSummary } from './api';
import { CategoryDonut } from './category-donut';
import { EvolutionChart } from './evolution-chart';

const pct = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 });

function Comparison({ label, kind, data }: { label: string; kind: 'income' | 'expense'; data: MonthComparison }) {
  const up = (data.changePercent ?? 0) >= 0;
  const Arrow = up ? ArrowUpRight : ArrowDownRight;
  return (
    <div className="grid gap-1">
      <span className="text-sm text-muted">{label}</span>
      <span className={`tabular font-display text-2xl font-bold tracking-tight ${kind === 'income' ? 'text-income' : 'text-expense'}`}>{formatBRL(data.current)}</span>
      <span aria-label={`Variação das ${kind === 'income' ? 'receitas' : 'despesas'}`} className="inline-flex items-center gap-1 text-xs text-muted">
        {data.changePercent === null ? (
          '—'
        ) : (
          <>
            <Arrow aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
            {pct.format(Math.abs(data.changePercent))}% vs mês anterior
          </>
        )}
      </span>
    </div>
  );
}

export default function DashboardPage() {
  const [month, setMonth] = useState<YearMonth>(monthOf(todayInSaoPaulo()));
  const [editing, setEditing] = useState<TransactionDTO | 'new' | null>(null);
  const summary = useSummary(month);
  const evolution = useEvolution(6);
  const byCategory = useByCategory(month);
  const accounts = useAccounts(true);
  const categories = useCategories();
  const accountById = new Map((accounts.data ?? []).map((a) => [a.id, a]));
  const categoryById = new Map((categories.data ?? []).map((c) => [c.id, c]));

  return (
    <>
      <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
        <MonthPicker value={month} onChange={setMonth} />
        <Button onClick={() => setEditing('new')}>
          <Plus aria-hidden className="h-4 w-4" strokeWidth={2} />
          Novo lançamento
        </Button>
      </div>

      {summary.isPending && (
        <div className="grid gap-4">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-20 w-full max-w-lg" />
          <Skeleton className="h-16 w-full max-w-2xl" />
        </div>
      )}
      {summary.isError && <ErrorState message={summary.error.message} onRetry={() => summary.refetch()} />}
      {summary.data && (
        <section className="aurora mb-10 grid gap-8">
          <div>
            <p className="text-sm text-muted">Saldo em todas as contas</p>
            <p aria-label="Saldo total" className="mt-2">
              <HeroAmount cents={summary.data.totalBalance} className="block text-[clamp(3rem,9vw,4.75rem)]" />
            </p>
            <p className="mt-3 text-sm text-muted">
              Previsão para o fim do mês: <span className="tabular font-semibold text-text">{formatBRL(summary.data.forecastEndOfMonth)}</span>
            </p>
          </div>
          <div className="grid grid-cols-2 gap-6 border-t border-border pt-6 sm:max-w-xl">
            <Comparison label={`Receitas em ${formatMonthLabel(summary.data.month).split(' ')[0]}`} kind="income" data={summary.data.income} />
            <Comparison label={`Despesas em ${formatMonthLabel(summary.data.month).split(' ')[0]}`} kind="expense" data={summary.data.expense} />
          </div>
        </section>
      )}

      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr] [&>*]:min-w-0">
        <Panel className="p-5 sm:p-6">
          <h2 className="mb-4 font-display text-lg font-semibold tracking-tight">Últimos 6 meses</h2>
          {evolution.isPending && <Skeleton className="h-64" />}
          {evolution.isError && <ErrorState message={evolution.error.message} onRetry={() => evolution.refetch()} />}
          {evolution.data && <EvolutionChart data={evolution.data} />}
        </Panel>

        <Panel className="flex flex-col">
          <div className="flex items-baseline justify-between px-5 pt-5 sm:px-6 sm:pt-6">
            <h2 className="font-display text-lg font-semibold tracking-tight">A pagar</h2>
            {summary.data && (
              <span className="text-xs text-muted">
                {summary.data.pendingCount} pendente{summary.data.pendingCount === 1 ? '' : 's'}
                {summary.data.overdueCount > 0 && ` · ${summary.data.overdueCount} vencido${summary.data.overdueCount === 1 ? '' : 's'}`}
              </span>
            )}
          </div>
          {summary.data && summary.data.upcoming.length === 0 && (
            <div className="flex flex-1 items-center gap-3 px-6 py-8 text-sm text-muted">
              <CircleCheck aria-hidden className="h-5 w-5 text-primary" strokeWidth={1.75} />
              Tudo em dia neste mês.
            </div>
          )}
          {summary.data && summary.data.upcoming.length > 0 && (
            <ul className="mt-2 divide-y divide-border">
              {summary.data.upcoming.map((tx) => (
                <TransactionRow
                  key={tx.id}
                  tx={tx}
                  account={accountById.get(tx.accountId)}
                  destination={tx.destinationAccountId ? accountById.get(tx.destinationAccountId) : undefined}
                  category={tx.categoryId ? categoryById.get(tx.categoryId) : undefined}
                  onEdit={() => setEditing(tx)}
                />
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <Panel className="mt-6 p-5 sm:p-6">
        <h2 className="mb-5 font-display text-lg font-semibold tracking-tight">Para onde foi o dinheiro</h2>
        {byCategory.isPending && <Skeleton className="h-44" />}
        {byCategory.isError && <ErrorState message={byCategory.error.message} onRetry={() => byCategory.refetch()} />}
        {byCategory.data && byCategory.data.length === 0 && (
          <EmptyState icon={<PieChart className="h-6 w-6" strokeWidth={1.5} />} title="Sem despesas pagas neste mês" description="Quando você marcar despesas como pagas, elas aparecem aqui por categoria." />
        )}
        {byCategory.data && byCategory.data.length > 0 && <CategoryDonut data={byCategory.data} />}
      </Panel>

      {editing && <TransactionForm open onOpenChange={(o) => !o && setEditing(null)} {...(editing === 'new' ? {} : { transaction: editing })} />}
    </>
  );
}
