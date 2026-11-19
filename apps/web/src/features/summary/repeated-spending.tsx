import type { RepeatedSpending } from '@fincontrol/shared';
import { useQuery } from '@tanstack/react-query';
import { Repeat } from 'lucide-react';
import { Panel } from '../../components/ui/panel';
import { ErrorState } from '../../components/ui/states';
import { useApi } from '../../lib/api-context';
import { formatBRL, formatDate } from '../../lib/format';

export function useRepeated() {
  const api = useApi();
  return useQuery({ queryKey: ['repeated'], queryFn: () => api.get<RepeatedSpending[]>('/repeated') });
}

/** Gastos que se repetem (sub-projeto 10, S4): o que sai todo mês, com o custo do ano, para a pessoa revisar. */
export function RepeatedSpendingPanel() {
  const repeated = useRepeated();
  if (repeated.isError) return <ErrorState message={repeated.error.message} onRetry={() => repeated.refetch()} />;
  if (!repeated.data || repeated.data.length === 0) return null;
  const yearly = repeated.data.reduce((s, r) => s + r.yearly, 0);
  return (
    <Panel role="region" aria-label="Gastos que se repetem todo mês" className="grid gap-3 p-5">
      <div className="grid gap-1">
        <h2 className="inline-flex items-center gap-2 font-display text-lg font-semibold tracking-tight">
          <Repeat aria-hidden className="h-5 w-5" strokeWidth={1.75} />
          Gastos que se repetem todo mês
        </h2>
        <p className="text-sm text-muted">{`Somados, dão ${formatBRL(yearly)} por ano. Vale conferir se você ainda usa cada um.`}</p>
      </div>
      <ul className="divide-y divide-border">
        {repeated.data.map((r) => (
          <li key={r.description} className="flex flex-wrap items-center justify-between gap-2 py-3">
            <span className="min-w-0">
              <span className="block break-words text-sm font-medium">{r.description}</span>
              <span className="text-xs text-muted">
                {`Pago em ${r.months} meses · último em ${formatDate(r.lastDate)}${r.recurring ? ' · já é recorrência' : ''}`}
              </span>
            </span>
            <span className="text-right">
              <span className="tabular block text-sm font-semibold">{`${formatBRL(r.monthly)} por mês`}</span>
              <span className="tabular text-xs text-muted">{`${formatBRL(r.yearly)} por ano`}</span>
            </span>
          </li>
        ))}
      </ul>
    </Panel>
  );
}
