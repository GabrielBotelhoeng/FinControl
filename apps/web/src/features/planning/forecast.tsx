import { Panel } from '../../components/ui/panel';
import { ErrorState, Skeleton } from '../../components/ui/states';
import { cn } from '../../lib/cn';
import { formatBRL, formatMonthShort } from '../../lib/format';
import { useForecast } from './api';

const signed = (cents: number) => `${cents < 0 ? '−' : ''}${formatBRL(Math.abs(cents))}`;

/** Próximos 3 meses (P5): receitas e despesas pagas + previstas, e o saldo previsto de cada mês. */
export function Forecast() {
  const forecast = useForecast();
  return (
    <Panel role="region" aria-label="Próximos 3 meses" className="grid gap-4 p-5">
      <div>
        <h2 className="font-display text-lg font-semibold tracking-tight">Próximos 3 meses</h2>
        <p className="text-xs text-muted">Pelos lançamentos e recorrências já cadastrados.</p>
      </div>
      {forecast.isPending && <Skeleton className="h-24 rounded-[var(--radius-control)]" />}
      {forecast.isError && <ErrorState message={forecast.error.message} onRetry={() => forecast.refetch()} />}
      {forecast.data && (
        <ul className="grid gap-3 sm:grid-cols-3">
          {forecast.data.map((m) => {
            const balance = m.income - m.expense;
            return (
              <li key={m.month} className="grid gap-1 rounded-[var(--radius-control)] border border-border p-3 text-sm">
                <span className="font-semibold">{formatMonthShort(m.month)}</span>
                <span className="text-muted">
                  Receitas <span className="tabular text-text">{formatBRL(m.income)}</span>
                </span>
                <span className="text-muted">
                  Despesas <span className="tabular text-text">{formatBRL(m.expense)}</span>
                </span>
                <span className={cn('tabular font-semibold', balance < 0 ? 'text-expense' : 'text-income')}>{signed(balance)}</span>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}
