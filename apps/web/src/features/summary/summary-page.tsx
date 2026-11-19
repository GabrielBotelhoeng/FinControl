import { addMonthsToYm, monthOf, todayInSaoPaulo, type YearMonth } from '@fincontrol/shared';
import { CircleMinus, Sparkles, ThumbsDown, ThumbsUp, type LucideIcon } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { MonthPicker } from '../../components/ui/month-picker';
import { PageHeader } from '../../components/ui/page-header';
import { Panel } from '../../components/ui/panel';
import { EmptyState, ErrorState, ListSkeleton } from '../../components/ui/states';
import { cn } from '../../lib/cn';
import { useBudgetMonth } from '../planning/api';
import { useReport } from '../reports/api';
import { monthInsights, type InsightTone } from './insights';
import { RepeatedSpendingPanel } from './repeated-spending';

const TONE: Record<InsightTone, { icon: LucideIcon; className: string; label: string }> = {
  good: { icon: ThumbsUp, className: 'text-income', label: 'Ponto positivo' },
  bad: { icon: ThumbsDown, className: 'text-expense', label: 'Ponto de atenção' },
  neutral: { icon: CircleMinus, className: 'text-muted', label: 'Informação' },
};

/** Resumo do mês (sub-projeto 8, M1): por padrão o mês passado, que já fechou. */
export default function SummaryPage() {
  const current = monthOf(todayInSaoPaulo());
  const [month, setMonth] = useState<YearMonth>(addMonthsToYm(current, -1));
  const report = useReport(month, month);
  const budget = useBudgetMonth(month);
  // Espera o orçamento (ou a falha dele) para a tela não pular quando a frase do orçamento chega depois.
  const insights = report.data && !budget.isPending ? monthInsights(month, report.data, budget.isError ? null : (budget.data ?? null)) : null;
  const previous = addMonthsToYm(current, -1);

  return (
    <>
      <PageHeader
        light="Resumo do"
        bold="mês"
        description="O que mudou no mês em poucas frases: gastos, sobra, categorias, orçamento e dívidas."
        actions={<MonthPicker value={month} onChange={setMonth} max={previous} />}
      />

      {(report.isPending || budget.isPending) && <ListSkeleton />}
      {budget.isError && !report.isError && (
        <div className="mb-4">
          <ErrorState message={`O orçamento não carregou, e a frase dele ficou de fora. ${budget.error.message}`} onRetry={() => budget.refetch()} />
        </div>
      )}
      {report.isError && <ErrorState message={report.error.message} onRetry={() => report.refetch()} />}
      {insights && insights.length === 0 && (
        <EmptyState
          icon={<Sparkles className="h-7 w-7" strokeWidth={1.5} />}
          title="Nada para resumir neste mês"
          description="Quando houver lançamentos pagos no mês, o resumo aparece aqui."
        />
      )}
      {insights && insights.length > 0 && (
        <div className="grid grid-cols-1 gap-6">
          <ul className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {insights.map((i) => {
              const tone = TONE[i.tone];
              return (
                <li key={i.id}>
                  <Panel className="flex h-full gap-4 p-5">
                    <span className={cn('grid h-10 w-10 shrink-0 place-items-center rounded-full bg-surface-2', tone.className)}>
                      <tone.icon aria-label={tone.label} className="h-5 w-5" strokeWidth={1.75} />
                    </span>
                    <div className="grid min-w-0 content-start gap-1">
                      <p className="break-words font-display text-lg font-semibold tracking-tight">{i.title}</p>
                      {i.detail && <p className="break-words text-sm text-muted">{i.detail}</p>}
                    </div>
                  </Panel>
                </li>
              );
            })}
          </ul>
          <p className="text-sm text-muted">
            Quer os números completos?{' '}
            <Link to="/relatorios" className="font-medium text-primary hover:underline">
              Ver o relatório
            </Link>{' '}
            ou pergunte ao{' '}
            <Link to="/assistente" className="font-medium text-primary hover:underline">
              assistente
            </Link>
            .
          </p>
        </div>
      )}
      {insights && (
        <div className="mt-6">
          <RepeatedSpendingPanel />
        </div>
      )}
    </>
  );
}
