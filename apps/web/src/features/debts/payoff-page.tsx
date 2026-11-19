import {
  addMonthsToYm, minimumBudget, monthOf, simulatePayoff, todayInSaoPaulo,
  type DebtDTO, type LoanDTO, type PayoffDebt, type PayoffResult, type PayoffStrategy,
} from '@fincontrol/shared';
import { ArrowLeft, Snowflake, TrendingDown, Turtle, type LucideIcon } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Field, Input } from '../../components/ui/field';
import { MoneyInput } from '../../components/ui/money-input';
import { PageHeader } from '../../components/ui/page-header';
import { Panel } from '../../components/ui/panel';
import { EmptyState, ErrorState, ListSkeleton } from '../../components/ui/states';
import { cn } from '../../lib/cn';
import { formatBRL, formatMonthLabel, formatMonthShort } from '../../lib/format';
import { useAuth } from '../auth/auth-context';
import { useLoans } from '../loans/api';
import { useDebts } from './api';

/** Juros e parcela das dívidas sem acordo (Q1): só a pessoa sabe; ficam neste navegador. */
type Overrides = Record<string, { rate: string; minimum: number | null }>;
/** `budget` ausente = a pessoa ainda não mexeu (vale o mínimo); `null` = apagou o campo. */
type Saved = { budget?: number | null; overrides: Overrides };
/** Uma chave por pessoa: quem entrar depois no mesmo navegador não vê os juros e o valor de outra (CodeRabbit). */
const STORAGE_KEY = 'fincontrol-plano-quitacao';
const storageKey = (userId: string | undefined) => `${STORAGE_KEY}:${userId ?? 'sem-sessao'}`;

const isCents = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0;

/** Lê e confere o formato: dado corrompido ou de outra versão é descartado, nunca derruba a página. */
function load(key: string): Saved {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(key) ?? 'null');
    if (!raw || typeof raw !== 'object') return { overrides: {} };
    const r = raw as Record<string, unknown>;
    const overrides: Overrides = {};
    if (r.overrides && typeof r.overrides === 'object') {
      for (const [id, v] of Object.entries(r.overrides as Record<string, unknown>)) {
        const o = v as Record<string, unknown> | null;
        if (!o || typeof o.rate !== 'string' || !(o.minimum === null || isCents(o.minimum))) continue;
        overrides[id] = { rate: o.rate, minimum: o.minimum as number | null };
      }
    }
    return { overrides, ...(r.budget === null || isCents(r.budget) ? { budget: r.budget as number | null } : {}) };
  } catch {
    // Sem armazenamento (aba anônima ou bloqueado) ou JSON inválido: começa vazio.
    return { overrides: {} };
  }
}

function save(key: string, s: Saved) {
  try {
    localStorage.setItem(key, JSON.stringify(s));
  } catch {
    // Só uma conveniência: sem armazenamento, o plano vale até sair da página.
  }
}

export const MAX_RATE_PERCENT = 30;

/** "2,5" → 0,025; vazio ou inválido → 0; acima de 30% ao mês fica em 30% (o mesmo teto do aviso do empréstimo). */
const parseRate = (text: string) => {
  const n = Number(text.trim().replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? Math.min(n, MAX_RATE_PERCENT) / 100 : 0;
};

const compactBRL = new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 });

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
        {result.payoffMonth ? `Quita em ${formatMonthLabel(result.payoffMonth)}` : 'Não quita em 50 anos'}
      </span>
      <span className="tabular text-sm text-muted">
        {result.months !== null
          ? `${result.months} ${result.months === 1 ? 'mês' : 'meses'} · ${formatBRL(result.totalInterest)} de juros`
          : 'Com este valor, os juros crescem mais que o pagamento ou a quitação passa de 50 anos'}
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
            <YAxis tickFormatter={(v: number) => compactBRL.format(v / 100)} tickLine={false} axisLine={false} width={52} tick={{ fill: 'var(--text-muted)', fontSize: 12 }} />
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
        {results.map((r) => `${STRATEGIES[r.strategy].label}: ${r.payoffMonth ? `quita em ${formatMonthLabel(r.payoffMonth)}` : 'não quita em 50 anos'}`).join('; ')}
      </figcaption>
    </figure>
  );
}

export default function PayoffPage() {
  const loans = useLoans();
  const debts = useDebts();
  const key = storageKey(useAuth().user?.id);
  const [saved, setSaved] = useState<Saved>(() => load(key));
  // A sessão chega depois do 1º desenho: troca para os dados da pessoa quando ela aparece.
  useEffect(() => setSaved(load(key)), [key]);
  const [selected, setSelected] = useState<PayoffStrategy>('avalanche');
  const update = (next: Saved) => {
    setSaved(next);
    save(key, next);
  };
  const current = monthOf(todayInSaoPaulo());
  // A parcela deste mês ainda em aberto faz parte do saldo: o plano começa neste mês (revisão final).
  const dueThisMonth = [...(loans.data ?? []), ...(debts.data ?? [])].some((x) => x.nextDue && monthOf(x.nextDue.date) <= current);
  const start = dueThisMonth ? current : addMonthsToYm(current, 1);

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
  const lateDebts = debts.data?.filter((d) => d.status === 'late') ?? [];
  const charted = results?.filter((r) => r.months !== null) ?? [];
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
      {error && (
        <ErrorState
          message={error.message}
          onRetry={() => {
            if (loans.isError) void loans.refetch();
            if (debts.isError) void debts.refetch();
          }}
        />
      )}
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
                  const set = (patch: Partial<Overrides[string]>) => {
                    // Só as dívidas que ainda estão em aberto: as apagadas ou em acordo saem do navegador.
                    const kept = Object.fromEntries(Object.entries(saved.overrides).filter(([id]) => openDebts.some((x) => x.id === id)));
                    update({ ...saved, overrides: { ...kept, [d.id]: { ...o, ...patch } } });
                  };
                  return (
                    <div key={d.id} className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_10rem_12rem] sm:items-end">
                      <p className="truncate text-sm font-medium sm:pb-3">{`${d.name} · ${formatBRL(d.balance)}`}</p>
                      <Field
                        label={`Juros ao mês (%) de ${d.name}`}
                        error={Number(o.rate.trim().replace(',', '.')) > MAX_RATE_PERCENT ? `Máximo de ${MAX_RATE_PERCENT}% ao mês: o plano usa ${MAX_RATE_PERCENT}%.` : undefined}
                      >
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
            {lateDebts.length > 0 && (
              <p className="text-sm font-medium text-expense">
                {`${lateDebts.map((d) => d.name).join(', ')}: parcela atrasada. O plano supõe que você põe em dia agora; o que está vencido não entra no valor mínimo.`}
              </p>
            )}
            {minimum === 0 && budget === 0 && (
              <p className="text-sm">Informe quanto pode pagar por mês para ver em quanto tempo sai das dívidas.</p>
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
                <p className="text-sm">
                  {(() => {
                    const b = results.find((r) => r.strategy === best)!;
                    const min = results.find((r) => r.strategy === 'minimum')!;
                    if (best === 'minimum') return 'Pagar só as parcelas já é o caminho com menos juros com este valor.';
                    return min.months === null
                      ? `Pagando só as parcelas, alguma dívida não acaba em 50 anos. Com ${STRATEGIES[best].label.toLowerCase()}, você quita tudo em ${formatMonthLabel(b.payoffMonth!)}.`
                      : `Com ${STRATEGIES[best].label.toLowerCase()}, você economiza ${formatBRL(min.totalInterest - b.totalInterest)} em juros em relação a pagar só as parcelas.`;
                  })()}
                </p>
              )}

              {charted.length > 0 && (
                <Panel role="region" aria-label="Saldo devedor ao longo do tempo" className="grid gap-3 p-5">
                  <h2 className="font-display text-lg font-semibold tracking-tight">Saldo devedor ao longo do tempo</h2>
                  <BalanceChart results={charted} start={start} />
                </Panel>
              )}

              {chosen && (
                <Panel role="region" aria-label="Ordem de quitação" className="grid gap-4 p-5">
                  <div className="grid gap-1">
                    <h2 className="font-display text-lg font-semibold tracking-tight">{`Ordem de quitação · ${STRATEGIES[selected].label}`}</h2>
                    <p className="text-xs text-muted">Toque num dos cartões acima para ver a ordem de outra estratégia.</p>
                  </div>
                  <ol className="grid gap-3">
                    {chosen.order.map((o, i) => (
                      <li key={o.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                        <span className="min-w-0 truncate">{`${i + 1}. ${o.name}`}</span>
                        <span className="tabular text-muted">{o.month === null ? 'não acaba em 50 anos' : `quitada em ${formatMonthLabel(addMonthsToYm(start, o.month - 1))}`}</span>
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
