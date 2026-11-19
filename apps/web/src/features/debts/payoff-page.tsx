import {
  addMonthsToYm, minimumBudget, monthOf, simulatePayoff, todayInSaoPaulo,
  type DebtDTO, type LoanDTO, type PayoffDebt, type PayoffResult, type PayoffStrategy,
} from '@fincontrol/shared';
import { ArrowLeft, Snowflake, TrendingDown, Turtle, type LucideIcon } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Field, Input } from '../../components/ui/field';
import { MoneyInput } from '../../components/ui/money-input';
import { PageHeader } from '../../components/ui/page-header';
import { Panel } from '../../components/ui/panel';
import { Segmented } from '../../components/ui/segmented';
import { EmptyState, ErrorState, ListSkeleton } from '../../components/ui/states';
import { cn } from '../../lib/cn';
import { formatBRL, formatMonthLabel, formatMonthShort } from '../../lib/format';
import { useLoans } from '../loans/api';
import { useDebts } from './api';

/** Juros e parcela das dívidas sem acordo (Q1): só a pessoa sabe; ficam neste navegador. */
type Overrides = Record<string, { rate: string; minimum: number | null }>;
/** `budget` ausente = a pessoa ainda não mexeu (vale o mínimo); `null` = apagou o campo. */
type Saved = { budget?: number | null; overrides: Overrides };
const STORAGE_KEY = 'fincontrol-plano-quitacao';

function load(): Saved {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { overrides: {}, ...(JSON.parse(raw) as Partial<Saved>) };
  } catch {
    // Sem armazenamento (aba anônima ou bloqueado): começa vazio.
  }
  return { overrides: {} };
}

function save(s: Saved) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    // Só uma conveniência: sem armazenamento, o plano vale até sair da página.
  }
}

/** "2,5" → 0,025; vazio ou inválido → 0. */
const parseRate = (text: string) => {
  const n = Number(text.trim().replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? n / 100 : 0;
};

const STRATEGIES: Record<PayoffStrategy, { label: string; hint: string; icon: LucideIcon; color: string }> = {
  avalanche: { label: 'Avalanche', hint: 'Maior juros primeiro', icon: TrendingDown, color: 'var(--primary)' },
  snowball: { label: 'Bola de neve', hint: 'Menor saldo primeiro', icon: Snowflake, color: 'var(--income)' },
  minimum: { label: 'Só o mínimo', hint: 'Só as parcelas', icon: Turtle, color: 'var(--text-muted)' },
};

/** Q1: empréstimos (taxa real e parcela), dívidas em acordo (parcela, sem juros) e as em aberto (dados da pessoa). */
function toPayoffDebts(loans: LoanDTO[], debts: DebtDTO[], overrides: Overrides): PayoffDebt[] {
  const out: PayoffDebt[] = [];
  for (const l of loans) {
    if (l.outstanding <= 0) continue;
    out.push({ id: `loan-${l.id}`, name: l.name, balance: l.outstanding, monthlyRate: l.monthlyRate, minimum: l.installmentAmount });
  }
  for (const d of debts) {
    if (d.status === 'paid_off') continue;
    if (d.status === 'agreement' || d.status === 'late') {
      out.push({ id: `debt-${d.id}`, name: d.name, balance: d.balance, monthlyRate: 0, minimum: d.nextDue?.amount ?? 0 });
    } else {
      const o = overrides[d.id];
      out.push({ id: `debt-${d.id}`, name: d.name, balance: d.balance, monthlyRate: parseRate(o?.rate ?? ''), minimum: o?.minimum ?? 0 });
    }
  }
  return out;
}

function StrategyCard({ result, best, selected, onSelect }: { result: PayoffResult; best: boolean; selected: boolean; onSelect: () => void }) {
  const s = STRATEGIES[result.strategy];
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      aria-label={`${s.label}: ${result.payoffMonth ? `quita em ${formatMonthLabel(result.payoffMonth)}` : 'não quita'}, ${formatBRL(result.totalInterest)} de juros`}
      className={cn(
        'grid gap-2 rounded-[var(--radius-panel)] border bg-surface p-5 text-left transition-colors',
        selected ? 'border-primary' : 'border-border hover:border-muted',
      )}
    >
      <span className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-2 font-display text-lg font-semibold">
          <s.icon aria-hidden className="h-5 w-5" strokeWidth={1.75} />
          {s.label}
        </span>
        {best && <span className="rounded-full bg-primary-soft px-2.5 py-0.5 text-xs font-medium text-primary">Menos juros</span>}
      </span>
      <span className="text-xs text-muted">{s.hint}</span>
      <span className="tabular font-display text-xl font-semibold">
        {result.payoffMonth ? `Quita em ${formatMonthLabel(result.payoffMonth)}` : 'Não quita'}
      </span>
      <span className="tabular text-sm text-muted">
        {result.months !== null ? `${result.months} ${result.months === 1 ? 'mês' : 'meses'} · ` : ''}
        {`${formatBRL(result.totalInterest)} de juros`}
      </span>
    </button>
  );
}

function BalanceChart({ results, start }: { results: PayoffResult[]; start: string }) {
  const length = Math.min(Math.max(...results.map((r) => r.balances.length)), 120);
  const data = Array.from({ length }, (_, i) => {
    const point: Record<string, number | string> = { month: addMonthsToYm(start, i) };
    for (const r of results) point[r.strategy] = r.balances[Math.min(i, r.balances.length - 1)] ?? 0;
    return point;
  });
  return (
    <figure>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--border)" />
            <XAxis dataKey="month" tickFormatter={formatMonthShort} tickLine={false} axisLine={false} tick={{ fill: 'var(--text-muted)', fontSize: 12 }} minTickGap={16} />
            <YAxis tickFormatter={(v: number) => `${Math.round(v / 100000)} mil`} tickLine={false} axisLine={false} width={52} tick={{ fill: 'var(--text-muted)', fontSize: 12 }} />
            <Tooltip
              formatter={(v, name) => [formatBRL(Number(v)), STRATEGIES[name as PayoffStrategy].label]}
              labelFormatter={(m) => formatMonthShort(String(m))}
            />
            <Legend formatter={(name: string) => STRATEGIES[name as PayoffStrategy].label} />
            {results.map((r) => (
              <Line key={r.strategy} dataKey={r.strategy} type="monotone" stroke={STRATEGIES[r.strategy].color} strokeWidth={2} dot={false} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <figcaption className="sr-only">
        {results.map((r) => `${STRATEGIES[r.strategy].label}: ${r.payoffMonth ? `quita em ${formatMonthLabel(r.payoffMonth)}` : 'não quita'}`).join('; ')}
      </figcaption>
    </figure>
  );
}

export default function PayoffPage() {
  const loans = useLoans();
  const debts = useDebts();
  const [saved, setSaved] = useState<Saved>(load);
  const [selected, setSelected] = useState<PayoffStrategy>('avalanche');
  const update = (next: Saved) => {
    setSaved(next);
    save(next);
  };
  const start = addMonthsToYm(monthOf(todayInSaoPaulo()), 1);

  const input = useMemo(
    () => (loans.data && debts.data ? toPayoffDebts(loans.data, debts.data, saved.overrides) : null),
    [loans.data, debts.data, saved.overrides],
  );
  const minimum = input ? minimumBudget(input) : 0;
  const budgetField = saved.budget === undefined ? minimum : saved.budget;
  const budget = budgetField ?? 0;
  const tooLow = budget < minimum;
  const results = useMemo(
    () => (input && !tooLow ? (['avalanche', 'snowball', 'minimum'] as const).map((s) => simulatePayoff(input, budget, s, start)) : null),
    [input, budget, tooLow, start],
  );
  const finishing = results?.filter((r) => r.months !== null) ?? [];
  const best = finishing.length ? finishing.reduce((a, b) => (b.totalInterest < a.totalInterest ? b : a)).strategy : null;
  const chosen = results?.find((r) => r.strategy === selected);
  const openDebts = debts.data?.filter((d) => d.status === 'open') ?? [];
  const isPending = loans.isPending || debts.isPending;
  const error = loans.error ?? debts.error;

  return (
    <>
      <PageHeader
        light="Plano de"
        bold="quitação"
        description="Quanto tempo e quanto de juros para sair das dívidas, conforme a ordem em que você paga."
        actions={
          <Link to="/dividas" className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
            <ArrowLeft aria-hidden className="h-4 w-4" />
            Voltar para as dívidas
          </Link>
        }
      />

      {isPending && <ListSkeleton />}
      {error && <ErrorState message={error.message} onRetry={() => (loans.isError ? loans.refetch() : debts.refetch())} />}
      {input && input.length === 0 && (
        <EmptyState
          icon={<TrendingDown className="h-7 w-7" strokeWidth={1.5} />}
          title="Nenhuma dívida para quitar"
          description="Empréstimos e dívidas com credores aparecem aqui. Compras parceladas no cartão não têm juros e ficam fora do plano."
        />
      )}

      {input && input.length > 0 && (
        <div className="grid grid-cols-1 gap-6">
          <Panel role="group" aria-label="Dados do plano" className="grid gap-5 p-5">
            <Field
              label="Quanto você pode pagar por mês para dívidas"
              hint={`O mínimo é ${formatBRL(minimum)}, a soma das parcelas. O que passar disso vai para a dívida da vez.`}
              error={tooLow ? `Precisa ser pelo menos ${formatBRL(minimum)} para cobrir as parcelas.` : undefined}
            >
              <MoneyInput value={budgetField} onChange={(v) => update({ ...saved, budget: v })} />
            </Field>
            {openDebts.length > 0 && (
              <div className="grid gap-4">
                <p className="text-sm text-muted">Dívidas sem acordo: informe os juros que o credor cobra e a parcela, se houver. Sem juros, o plano considera 0%.</p>
                {openDebts.map((d) => {
                  const o = saved.overrides[d.id] ?? { rate: '', minimum: null };
                  const set = (patch: Partial<Overrides[string]>) => update({ ...saved, overrides: { ...saved.overrides, [d.id]: { ...o, ...patch } } });
                  return (
                    <div key={d.id} className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_10rem_12rem] sm:items-end">
                      <p className="truncate text-sm font-medium sm:pb-3">{`${d.name} · ${formatBRL(d.balance)}`}</p>
                      <Field label={`Juros ao mês (%) de ${d.name}`}>
                        <Input inputMode="decimal" value={o.rate} placeholder="Ex.: 8" onChange={(e) => set({ rate: e.target.value })} />
                      </Field>
                      <Field label={`Parcela de ${d.name}`}>
                        <MoneyInput value={o.minimum} onChange={(v) => set({ minimum: v })} />
                      </Field>
                    </div>
                  );
                })}
              </div>
            )}
            <p className="text-xs text-muted">Compras parceladas no cartão não têm juros e ficam fora do plano. É uma simulação: o banco pode cobrar diferente.</p>
          </Panel>

          {results && (
            <>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                {results.map((r) => (
                  <StrategyCard key={r.strategy} result={r} best={r.strategy === best} selected={r.strategy === selected} onSelect={() => setSelected(r.strategy)} />
                ))}
              </div>

              {best && results.find((r) => r.strategy === 'minimum') && (
                <p role="status" className="text-sm">
                  {(() => {
                    const b = results.find((r) => r.strategy === best)!;
                    const min = results.find((r) => r.strategy === 'minimum')!;
                    if (best === 'minimum') return 'Pagar só as parcelas já é o caminho com menos juros com este valor.';
                    return min.months === null
                      ? `Pagando só as parcelas, alguma dívida nunca acaba. Com ${STRATEGIES[best].label.toLowerCase()}, você quita tudo em ${formatMonthLabel(b.payoffMonth!)}.`
                      : `Com ${STRATEGIES[best].label.toLowerCase()}, você economiza ${formatBRL(min.totalInterest - b.totalInterest)} em juros em relação a pagar só as parcelas.`;
                  })()}
                </p>
              )}

              <Panel role="region" aria-label="Saldo devedor ao longo do tempo" className="grid gap-3 p-5">
                <h2 className="font-display text-lg font-semibold tracking-tight">Saldo devedor ao longo do tempo</h2>
                <BalanceChart results={results} start={start} />
              </Panel>

              {chosen && (
                <Panel role="region" aria-label="Ordem de quitação" className="grid gap-4 p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h2 className="font-display text-lg font-semibold tracking-tight">Ordem de quitação</h2>
                    <Segmented
                      label="Estratégia"
                      options={(Object.keys(STRATEGIES) as PayoffStrategy[]).map((s) => ({ value: s, label: STRATEGIES[s].label }))}
                      value={selected}
                      onChange={setSelected}
                    />
                  </div>
                  <ol className="grid gap-3">
                    {chosen.order.map((o, i) => (
                      <li key={o.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                        <span className="min-w-0 truncate">{`${i + 1}. ${o.name}`}</span>
                        <span className="tabular text-muted">{o.month === null ? 'não acaba' : `quitada em ${formatMonthLabel(addMonthsToYm(start, o.month - 1))}`}</span>
                      </li>
                    ))}
                  </ol>
                </Panel>
              )}
            </>
          )}
        </div>
      )}
    </>
  );
}
