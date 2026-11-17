import { monthOf, todayInSaoPaulo, type ReportCategoryDTO, type ReportDTO, type YearMonth } from '@fincontrol/shared';
import { ArrowDownRight, ArrowUpRight, ChevronLeft, ChevronRight, FileSpreadsheet, FileText, Sparkles } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { toast } from 'sonner';
import { Button } from '../../components/ui/button';
import { MonthPicker } from '../../components/ui/month-picker';
import { PageHeader } from '../../components/ui/page-header';
import { Panel } from '../../components/ui/panel';
import { Segmented } from '../../components/ui/segmented';
import { EmptyState, ErrorState, Skeleton } from '../../components/ui/states';
import { useApi } from '../../lib/api-context';
import { cn } from '../../lib/cn';
import { formatBRL, formatDate, formatMonthShort } from '../../lib/format';
import { iconFor } from '../categories/icons';
import { exportFilename, saveFile, useReport, type ExportKind } from './api';
import { PERIOD_OPTIONS, periodRange, type PeriodMode } from './period';
import { DebtChart, MonthlyChart } from './report-charts';

const percent = new Intl.NumberFormat('pt-BR', { style: 'percent', maximumFractionDigits: 0 });
const signedPercent = new Intl.NumberFormat('pt-BR', { style: 'percent', maximumFractionDigits: 0, signDisplay: 'exceptZero' });
const signedBRL = (cents: number) => `${cents < 0 ? '−' : ''}${formatBRL(Math.abs(cents))}`;

/**
 * Variação contra o período anterior (R3), sempre com seta e texto. Em despesas, subir é ruim; em receitas, é bom.
 * Sem valor anterior, "novo" (ou nada, quando também não há valor agora).
 */
function Change({ change, kind, total }: { change: number | null; kind: 'income' | 'expense'; total: number }) {
  if (change === null) return <span className="text-xs text-muted">{total > 0 ? 'novo' : '—'}</span>;
  const up = change > 0;
  const Arrow = up ? ArrowUpRight : ArrowDownRight;
  const good = change === 0 ? null : (kind === 'income') === up;
  return (
    <span className={cn('inline-flex items-center gap-0.5 text-xs font-medium', good === null ? 'text-muted' : good ? 'text-income' : 'text-expense')}>
      {change !== 0 && <Arrow aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />}
      {signedPercent.format(change)}
    </span>
  );
}

function SummaryTile({ label, value, tone, detail }: { label: string; value: string; tone?: string; detail: ReactNode }) {
  return (
    <Panel role="group" aria-label={label} className="grid min-w-0 gap-1.5 p-4 sm:p-5">
      <span className="text-xs text-muted">{label}</span>
      <span className={cn('tabular font-display text-xl font-bold tracking-tight sm:text-2xl', tone)}>{value}</span>
      <span className="text-xs text-muted">{detail}</span>
    </Panel>
  );
}

function Summary({ report }: { report: ReportDTO }) {
  const t = report.totals;
  return (
    <section aria-label="Resumo do período" className="grid grid-cols-2 gap-3 lg:grid-cols-4 [&>*]:min-w-0">
      <SummaryTile
        label="Receitas"
        value={formatBRL(t.income)}
        tone="text-income"
        detail={
          <>
            <Change change={t.incomeChange} kind="income" total={t.income} /> vs. anterior
          </>
        }
      />
      <SummaryTile
        label="Despesas"
        value={formatBRL(t.expense)}
        tone="text-expense"
        detail={
          <>
            <Change change={t.expenseChange} kind="expense" total={t.expense} /> vs. anterior
          </>
        }
      />
      <SummaryTile label="Saldo do período" value={signedBRL(t.net)} tone={t.net < 0 ? 'text-expense' : undefined} detail="Receitas menos despesas" />
      <SummaryTile label="Taxa de poupança" value={t.savingsRate === null ? '—' : percent.format(t.savingsRate)} tone="text-primary" detail="Meta: 20% da renda" />
    </section>
  );
}

function CategoryList({ title, rows, kind }: { title: string; rows: ReportCategoryDTO[]; kind: 'income' | 'expense' }) {
  return (
    <Panel className="grid gap-4 p-5 sm:p-6">
      <div>
        <h2 className="font-display text-lg font-semibold tracking-tight">{title}</h2>
        <p className="text-xs text-muted">Participação no período e variação contra o período anterior.</p>
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-muted">Nada pago no período.</p>
      ) : (
        <ul aria-label={title} className="grid gap-3">
          {rows.map((r) => {
            const Icon = iconFor(r.icon);
            return (
              <li key={r.categoryId} aria-label={r.name} className="grid gap-1.5">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="inline-flex min-w-0 items-center gap-2">
                    <Icon aria-hidden className="h-4 w-4 shrink-0" style={{ color: r.color }} strokeWidth={1.75} />
                    <span className="truncate">{r.name}</span>
                  </span>
                  <span className="tabular shrink-0 font-semibold">{formatBRL(r.total)}</span>
                </div>
                <div aria-hidden className="h-1.5 overflow-hidden rounded-full bg-surface-2">
                  <div className={cn('h-full rounded-full', kind === 'income' ? 'bg-income' : 'bg-expense')} style={{ width: `${r.share * 100}%` }} />
                </div>
                <div className="flex items-center justify-between gap-3 text-xs text-muted">
                  <span>{`${percent.format(r.share)} do total · antes ${formatBRL(r.previous)}`}</span>
                  <Change change={r.change} kind={kind} total={r.total} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}

function TopExpenses({ report }: { report: ReportDTO }) {
  return (
    <Panel className="grid gap-4 p-5 sm:p-6">
      <h2 className="font-display text-lg font-semibold tracking-tight">Maiores despesas</h2>
      {report.topExpenses.length === 0 ? (
        <p className="text-sm text-muted">Nenhuma despesa paga no período.</p>
      ) : (
        <ol aria-label="Maiores despesas" className="grid divide-y divide-border">
          {report.topExpenses.map((e) => (
            <li key={e.id} className="flex items-center justify-between gap-3 py-2.5 text-sm first:pt-0">
              <span className="grid min-w-0">
                <span className="truncate">{e.description}</span>
                <span className="truncate text-xs text-muted">{`${formatDate(e.date)} · ${e.category} · ${e.account}`}</span>
              </span>
              <span className="tabular shrink-0 font-semibold">{formatBRL(e.amount)}</span>
            </li>
          ))}
        </ol>
      )}
    </Panel>
  );
}

function Balances({ report }: { report: ReportDTO }) {
  const { balances } = report;
  return (
    <Panel role="region" aria-label="Saldo das contas" className="grid gap-4 p-5 sm:p-6">
      <div>
        <h2 className="font-display text-lg font-semibold tracking-tight">{`Saldo das contas em ${formatDate(balances.date)}`}</h2>
        <p className="text-xs text-muted">Contas ativas, sem cartões. No fim do ano, é o que a ficha "Bens e Direitos" do IR pede.</p>
      </div>
      {balances.items.length === 0 ? (
        <p className="text-sm text-muted">Nenhuma conta ativa.</p>
      ) : (
        <ul className="grid divide-y divide-border text-sm">
          {balances.items.map((b) => (
            <li key={b.accountId} className="flex items-center justify-between gap-3 py-2.5 first:pt-0">
              <span className="truncate">{b.name}</span>
              <span className={cn('tabular shrink-0', b.balance < 0 && 'text-expense')}>{signedBRL(b.balance)}</span>
            </li>
          ))}
          <li className="flex items-center justify-between gap-3 py-2.5 font-semibold">
            <span>Total</span>
            <span className="tabular">{signedBRL(balances.total)}</span>
          </li>
        </ul>
      )}
    </Panel>
  );
}

function YearPicker({ value, onChange, max }: { value: number; onChange: (y: number) => void; max: number }) {
  return (
    <div className="inline-flex items-center gap-1 rounded-full border border-border bg-surface p-1">
      <Button variant="ghost" size="icon" className="h-9 w-9" aria-label="Ano anterior" onClick={() => onChange(value - 1)}>
        <ChevronLeft aria-hidden className="h-4 w-4" strokeWidth={1.75} />
      </Button>
      <span aria-live="polite" className="min-w-[5rem] text-center text-sm font-semibold">
        {value}
      </span>
      <Button variant="ghost" size="icon" className="h-9 w-9" aria-label="Próximo ano" disabled={value >= max} onClick={() => onChange(value + 1)}>
        <ChevronRight aria-hidden className="h-4 w-4" strokeWidth={1.75} />
      </Button>
    </div>
  );
}

function DownloadButtons({ from, to }: { from: YearMonth; to: YearMonth }) {
  const api = useApi();
  const [busy, setBusy] = useState<ExportKind | null>(null);
  const download = async (kind: ExportKind) => {
    setBusy(kind);
    try {
      const blob = await api.download(`/reports/export.${kind}`, { from, to });
      saveFile(blob, exportFilename(kind, from, to));
      toast.success(kind === 'pdf' ? 'Relatório baixado.' : 'Lançamentos baixados.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível baixar o arquivo.');
    } finally {
      setBusy(null);
    }
  };
  return (
    <>
      <Button variant="secondary" loading={busy === 'pdf'} disabled={busy !== null} onClick={() => download('pdf')}>
        <FileText aria-hidden className="h-4 w-4" strokeWidth={1.75} />
        Baixar PDF
      </Button>
      <Button variant="secondary" loading={busy === 'csv'} disabled={busy !== null} onClick={() => download('csv')}>
        <FileSpreadsheet aria-hidden className="h-4 w-4" strokeWidth={1.75} />
        Baixar CSV
      </Button>
    </>
  );
}

/** Relatórios (sub-projeto 4): período, resumo, categorias, evolução, dívidas, maiores despesas, saldos e exportação. */
export default function ReportsPage() {
  const current = monthOf(todayInSaoPaulo());
  const currentYear = Number(current.slice(0, 4));
  const [mode, setMode] = useState<PeriodMode>('mes');
  const [month, setMonth] = useState<YearMonth>(current);
  const [year, setYear] = useState(currentYear);
  const { from, to } = periodRange(mode, month, year, current);
  const report = useReport(from, to);
  const r = report.data;
  const nothingPaid = r !== undefined && r.totals.income === 0 && r.totals.expense === 0;

  return (
    <>
      <PageHeader
        light="Seus"
        bold="relatórios"
        description="Para onde foi o dinheiro, como receitas e dívidas evoluíram e o que mudou em relação ao período anterior."
        actions={<DownloadButtons from={from} to={to} />}
      />

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Segmented label="Período" options={PERIOD_OPTIONS} value={mode} onChange={setMode} />
        {mode === 'mes' && <MonthPicker value={month} onChange={setMonth} max={current} />}
        {mode === 'ano' && <YearPicker value={year} onChange={setYear} max={currentYear} />}
        {mode === '12m' && <span className="text-sm text-muted">{`${formatMonthShort(from)} a ${formatMonthShort(to)}`}</span>}
      </div>

      {report.isPending && (
        <div role="status" aria-label="Carregando" className="grid gap-4">
          <Skeleton className="h-24" />
          <Skeleton className="h-64" />
        </div>
      )}
      {report.isError && <ErrorState message={report.error.message} onRetry={() => report.refetch()} />}
      {r && (
        <div className="grid gap-6">
          {nothingPaid ? (
            <Panel className="px-6">
              <EmptyState
                icon={<Sparkles aria-hidden className="h-6 w-6" strokeWidth={1.75} />}
                title="Nada pago neste período"
                description="O relatório mostra o que já foi pago. Lance receitas e despesas, ou escolha outro período."
                action={
                  <Link to="/lancamentos" className="text-sm font-semibold text-primary underline-offset-4 hover:underline">
                    Ir para lançamentos
                  </Link>
                }
              />
            </Panel>
          ) : (
            <>
              <Summary report={r} />
              <div className="grid gap-6 lg:grid-cols-2 [&>*]:min-w-0">
                <CategoryList title="Gastos por categoria" rows={r.expenseByCategory} kind="expense" />
                <CategoryList title="Receitas por categoria" rows={r.incomeByCategory} kind="income" />
              </div>
            </>
          )}

          <div className="grid gap-6 lg:grid-cols-2 [&>*]:min-w-0">
            <Panel className="p-5 sm:p-6">
              <h2 className="mb-4 font-display text-lg font-semibold tracking-tight">Evolução mensal</h2>
              <MonthlyChart data={r.monthly} />
            </Panel>
            <Panel className="p-5 sm:p-6">
              <h2 className="font-display text-lg font-semibold tracking-tight">Evolução das dívidas</h2>
              <p className="mb-4 text-xs text-muted">
                {`${formatBRL(r.debts.at(-1)?.total ?? 0)} no fim de ${formatMonthShort(to)}: cartões com parcelas futuras e saldo devedor dos empréstimos.`}
              </p>
              <DebtChart data={r.debts} />
            </Panel>
          </div>

          <div className="grid gap-6 lg:grid-cols-2 [&>*]:min-w-0">
            {!nothingPaid && <TopExpenses report={r} />}
            <Balances report={r} />
          </div>

          <aside aria-label="Como o relatório é calculado" className="grid gap-1.5 text-xs leading-relaxed text-muted">
            <p>Regime de caixa: só entra o que foi pago, pela data de pagamento. Transferências entre contas ficam de fora.</p>
            <p>Na dívida do cartão, a compra parcelada conta inteira desde a 1ª parcela. A dívida de empréstimo é o saldo devedor, o mesmo da "quitação estimada".</p>
            <p>A comparação usa o período anterior de mesmo tamanho. "novo" indica que não havia valor antes.</p>
          </aside>
        </div>
      )}
    </>
  );
}
