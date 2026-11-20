import { addMonthsToYm, monthOf, todayInSaoPaulo, type DashboardSummaryDTO, type MonthComparison, type TransactionDTO, type YearMonth } from '@fincontrol/shared';
import { ArrowDownLeft, ArrowDownRight, ArrowUpRight, CircleCheck, PieChart, Plus, Sparkles, Wallet } from 'lucide-react';
import { Link } from 'react-router';
import { useState } from 'react';
import { Button } from '../../components/ui/button';
import { HeroAmount } from '../../components/ui/money';
import { MonthPicker } from '../../components/ui/month-picker';
import { Panel } from '../../components/ui/panel';
import { EmptyState, ErrorState, Skeleton } from '../../components/ui/states';
import { cn } from '../../lib/cn';
import { formatBRL, formatMonthLabel } from '../../lib/format';
import { BudgetCard } from './budget-card';
import { DebtCard } from './debt-card';
import { HealthTiles } from './health-tiles';
import { OnboardingCard } from './onboarding-card';
import { useAccounts } from '../accounts/api';
import { useAssistantConfig } from '../assistant/api';
import { useCategories } from '../categories/api';
import { categoryOf } from '../categories/tree';
import { TransactionForm } from '../transactions/transaction-form';
import { TransactionRow } from '../transactions/transaction-row';
import { useByCategory, useEvolution, useSummary } from './api';
import { CategoryDonut } from './category-donut';
import { EvolutionChart } from './evolution-chart';
import { InvoiceRow } from './invoice-row';

const pct = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 });

/** Receitas e despesas do mês em cartões da cor de cada uma (sub-projeto 16, L4), com a seta de entrada ou saída. */
function Comparison({ label, kind, data }: { label: string; kind: 'income' | 'expense'; data: MonthComparison }) {
  const up = (data.changePercent ?? 0) >= 0;
  const Arrow = up ? ArrowUpRight : ArrowDownRight;
  const Flow = kind === 'income' ? ArrowDownLeft : ArrowUpRight;
  return (
    <div className={cn('flex min-w-0 flex-col gap-1.5 rounded-[var(--radius-panel)] p-4 sm:p-5', kind === 'income' ? 'bg-income-soft' : 'bg-expense-soft')}>
      <span className="flex items-center gap-2 text-sm font-medium text-muted">
        <span aria-hidden className={cn('grid h-7 w-7 shrink-0 place-items-center rounded-full bg-surface', kind === 'income' ? 'text-income' : 'text-expense')}>
          <Flow className="h-4 w-4" strokeWidth={2.25} />
        </span>
        <span className="min-w-0">{label}</span>
      </span>
      <span className={`tabular font-display text-xl font-bold tracking-tight sm:text-2xl ${kind === 'income' ? 'text-income' : 'text-expense'}`}>{formatBRL(data.current)}</span>
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

/** O saldo num cartão verde-limão (sub-projeto 16, L4): a "moeda" tangerina e o ponto uva são só decoração. */
function BalanceCard({ summary }: { summary: DashboardSummaryDTO }) {
  return (
    <div className="brand-ring flex min-w-0 flex-col rounded-[var(--radius-card)] bg-brand p-6 text-brand-fg sm:p-7">
      <div className="flex items-start justify-between gap-3">
        <p className="pt-1 text-sm font-semibold">Saldo em todas as contas</p>
        <span aria-hidden className="relative grid h-12 w-12 shrink-0 place-items-center rounded-full bg-tangerine">
          <Wallet className="h-6 w-6 text-brand-fg" strokeWidth={2} />
          <span className="absolute -bottom-1 -left-2 h-4 w-4 rounded-full border-2 border-brand bg-grape" />
        </span>
      </div>
      <p aria-label="Saldo total" className="mt-1">
        <HeroAmount cents={summary.totalBalance} className="block text-[clamp(2.6rem,11vw,4.25rem)]" />
      </p>
      <div className="mt-5 grid gap-1 text-sm">
        <p>
          Previsão para o fim do mês: <span className="tabular font-bold">{formatBRL(summary.forecastEndOfMonth)}</span>
        </p>
        {/* B9 do sub-projeto 11; durante o deploy, a API antiga ainda não manda o número. */}
        {typeof summary.netWorth === 'number' && (
          <p>
            Patrimônio líquido: <span className="tabular font-bold">{formatBRL(summary.netWorth)}</span>
            {' · '}
            <Link to="/patrimonio" className="font-semibold underline decoration-2 underline-offset-2 hover:decoration-brand-fg/50">
              Ver patrimônio
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const today = todayInSaoPaulo();
  const [month, setMonth] = useState<YearMonth>(monthOf(today));
  const [editing, setEditing] = useState<TransactionDTO | 'new' | null>(null);
  const summary = useSummary(month);
  const evolution = useEvolution(6);
  const byCategory = useByCategory(month);
  const accounts = useAccounts(true);
  const categories = useCategories();
  const assistant = useAssistantConfig();
  const accountById = new Map((accounts.data ?? []).map((a) => [a.id, a]));
  const categoryById = new Map((categories.data ?? []).map((c) => [c.id, c]));

  return (
    <>
      <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
        <MonthPicker value={month} onChange={setMonth} />
        <div className="flex flex-wrap gap-2">
          {assistant.data?.enabled && assistant.data.allowed && (
          <Link
            to="/assistente"
            className="inline-flex h-11 items-center gap-2 rounded-full border border-border px-4 text-sm font-medium transition-colors hover:bg-surface-2"
          >
            <Sparkles aria-hidden className="h-4 w-4 text-primary" strokeWidth={1.75} />
            Perguntar ao assistente
          </Link>
          )}
          {/* No celular, o "+" da barra faz isso em qualquer tela (sub-projeto 16, L12). */}
          <div className="hidden md:block">
            <Button onClick={() => setEditing('new')}>
              <Plus aria-hidden className="h-4 w-4" strokeWidth={2} />
              Novo lançamento
            </Button>
          </div>
        </div>
      </div>

      <OnboardingCard />

      {summary.isPending && (
        <div className="grid gap-4">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-20 w-full max-w-lg" />
          <Skeleton className="h-16 w-full max-w-2xl" />
        </div>
      )}
      {summary.isError && <ErrorState message={summary.error.message} onRetry={() => summary.refetch()} />}
      {summary.data && (
        <section aria-label="Saldo do mês" className="mb-4 grid gap-3 lg:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)]">
          <BalanceCard summary={summary.data} />
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-1">
            <Comparison label={`Receitas em ${formatMonthLabel(summary.data.month).split(' ')[0]}`} kind="income" data={summary.data.income} />
            <Comparison label={`Despesas em ${formatMonthLabel(summary.data.month).split(' ')[0]}`} kind="expense" data={summary.data.expense} />
          </div>
        </section>
      )}

      {summary.data && (
        <section aria-label="Saúde financeira" className="mb-6">
          <HealthTiles health={summary.data.health} />
          <div className="mt-4 grid gap-4 lg:grid-cols-2 [&>*]:min-w-0">
            <BudgetCard budget={summary.data.budget ?? null} />
            <DebtCard debts={summary.data.debts ?? { cards: 0, loans: 0, total: 0 }} />
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
            <span className="flex flex-wrap items-baseline justify-end gap-x-3 gap-y-1">
              {summary.data && (
                <span className="text-xs text-muted">
                  {summary.data.pendingCount} pendente{summary.data.pendingCount === 1 ? '' : 's'}
                  {summary.data.overdueCount > 0 && ` · ${summary.data.overdueCount} vencido${summary.data.overdueCount === 1 ? '' : 's'}`}
                </span>
              )}
              <Link to={month <= addMonthsToYm(monthOf(today), 12) ? `/calendario?mes=${month}` : '/calendario'} className="text-xs font-medium text-primary hover:underline">
                Calendário
              </Link>
            </span>
          </div>
          {summary.data && summary.data.upcoming.length === 0 && (
            <div className="flex flex-1 items-center gap-3 px-6 py-8 text-sm text-muted">
              <CircleCheck aria-hidden className="h-5 w-5 text-primary" strokeWidth={1.75} />
              Tudo em dia neste mês.
            </div>
          )}
          {summary.data && summary.data.upcoming.length > 0 && (
            <ul className="mt-2 divide-y divide-border">
              {summary.data.upcoming.map((item) =>
                item.kind === 'invoice' ? (
                  <InvoiceRow key={`${item.cardId}-${item.month}`} item={item} />
                ) : (
                  <TransactionRow
                    key={item.id}
                    tx={item}
                    account={accountById.get(item.accountId)}
                    destination={item.destinationAccountId ? accountById.get(item.destinationAccountId) : undefined}
                    {...categoryOf(categoryById, item.categoryId)}
                    onEdit={() => setEditing(item)}
                  />
                ),
              )}
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
