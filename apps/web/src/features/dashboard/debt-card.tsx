import type { DebtsDTO } from '@fincontrol/shared';
import { CheckCircle2, Landmark } from 'lucide-react';
import { Link } from 'react-router';
import { Panel } from '../../components/ui/panel';
import { formatBRL } from '../../lib/format';

/** Total de dívidas hoje (sub-projeto 4, R8): cartões com parcelas futuras + saldo devedor dos empréstimos. */
export function DebtCard({ debts }: { debts: DebtsDTO }) {
  return (
    <Panel role="region" aria-label="Total de dívidas" className="flex flex-wrap items-center justify-between gap-4 p-5">
      <div className="grid min-w-0 gap-1.5">
        <span className="inline-flex items-center gap-2 text-sm text-muted">
          <Landmark aria-hidden className="h-4 w-4" strokeWidth={1.75} />
          Total de dívidas
        </span>
        {debts.total === 0 ? (
          <span className="inline-flex items-center gap-1.5 text-sm font-medium text-income">
            <CheckCircle2 aria-hidden className="h-4 w-4" strokeWidth={2} />
            Nenhuma dívida em cartões ou empréstimos
          </span>
        ) : (
          <>
            <span className="tabular font-display text-xl font-semibold">{formatBRL(debts.total)}</span>
            <span className="tabular text-sm text-muted">{`Cartões ${formatBRL(debts.cards)} · Empréstimos ${formatBRL(debts.loans)}`}</span>
          </>
        )}
      </div>
      <Link to="/relatorios" className="text-sm font-medium text-primary hover:underline">
        Ver relatórios
      </Link>
    </Panel>
  );
}
