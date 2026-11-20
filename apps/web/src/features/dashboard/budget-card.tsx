import type { BudgetSummaryDTO } from '@fincontrol/shared';
import { AlertTriangle, CheckCircle2, CircleSlash, Target } from 'lucide-react';
import { Link } from 'react-router';
import { IconTile } from '../../components/ui/icon-tile';
import { Panel } from '../../components/ui/panel';
import { formatBRL } from '../../lib/format';
import { PALETTE } from '../../lib/palette';

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** Orçamento do mês no painel (sub-projeto 3, P10): comprometido ÷ orçamento total e as categorias em alerta. */
export function BudgetCard({ budget }: { budget: BudgetSummaryDTO | null }) {
  const link = (
    <Link to="/planejamento" className="text-sm font-medium text-primary hover:underline">
      Ver planejamento
    </Link>
  );

  return (
    <Panel role="region" aria-label="Orçamento do mês" className="flex flex-wrap items-center justify-between gap-4 p-5">
      <div className="flex min-w-0 items-start gap-3.5">
        <IconTile icon={Target} color={PALETTE.tangerine} size="lg" />
        <div className="grid min-w-0 gap-1.5">
          <span className="text-sm text-muted">Orçamento do mês</span>
          {budget === null ? (
            <span className="text-sm">Defina limites por categoria para acompanhar o mês.</span>
          ) : (
            <>
              <span className="tabular font-display text-xl font-semibold">{`${formatBRL(budget.committed)} de ${formatBRL(budget.limit)}`}</span>
              <span className="flex flex-wrap gap-x-4 gap-y-1 text-sm font-medium">
                {budget.overCount > 0 && (
                  <span className="inline-flex items-center gap-1.5 text-expense">
                    <CircleSlash aria-hidden className="h-4 w-4" strokeWidth={2} />
                    {plural(budget.overCount, 'categoria estourou', 'categorias estouraram')}
                  </span>
                )}
                {budget.nearCount > 0 && (
                  <span className="inline-flex items-center gap-1.5 text-warning">
                    <AlertTriangle aria-hidden className="h-4 w-4" strokeWidth={2} />
                    {plural(budget.nearCount, 'categoria perto do limite', 'categorias perto do limite')}
                  </span>
                )}
                {budget.overCount === 0 && budget.nearCount === 0 && (
                  <span className="inline-flex items-center gap-1.5 text-income">
                    <CheckCircle2 aria-hidden className="h-4 w-4" strokeWidth={2} />
                    Todas as categorias dentro do limite
                  </span>
                )}
              </span>
            </>
          )}
        </div>
      </div>
      {link}
    </Panel>
  );
}
