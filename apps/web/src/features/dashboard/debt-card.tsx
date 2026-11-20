import type { DebtsDTO } from '@fincontrol/shared';
import { CheckCircle2, HandCoins } from 'lucide-react';
import { Link } from 'react-router';
import { IconTile } from '../../components/ui/icon-tile';
import { Panel } from '../../components/ui/panel';
import { formatBRL } from '../../lib/format';
import { PALETTE } from '../../lib/palette';

/** Total de dívidas hoje (sub-projeto 4, R8, e 6, V11): cartões com parcelas futuras, saldo devedor dos empréstimos e dívidas com credores. */
export function DebtCard({ debts }: { debts: DebtsDTO }) {
  return (
    <Panel role="region" aria-label="Total de dívidas" className="flex flex-wrap items-center justify-between gap-4 p-5">
      <div className="flex min-w-0 items-start gap-3.5">
        <IconTile icon={HandCoins} color={PALETTE.grape} size="lg" />
        <div className="grid min-w-0 gap-1.5">
          <span className="text-sm text-muted">Total de dívidas</span>
          {debts.total === 0 ? (
            <span className="inline-flex items-center gap-1.5 text-sm font-medium text-income">
              <CheckCircle2 aria-hidden className="h-4 w-4" strokeWidth={2} />
              Nenhuma dívida em cartões, empréstimos ou com credores
            </span>
          ) : (
            <>
              <span className="tabular font-display text-xl font-semibold">{formatBRL(debts.total)}</span>
              <span className="tabular text-sm text-muted">
                {`Cartões ${formatBRL(debts.cards)} · Empréstimos ${formatBRL(debts.loans)}${debts.others > 0 ? ` · Credores ${formatBRL(debts.others)}` : ''}`}
              </span>
            </>
          )}
        </div>
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        <Link to="/dividas" className="text-sm font-medium text-primary hover:underline">
          Ver dívidas
        </Link>
        <Link to="/relatorios" className="text-sm font-medium text-primary hover:underline">
          Ver relatórios
        </Link>
      </div>
    </Panel>
  );
}
