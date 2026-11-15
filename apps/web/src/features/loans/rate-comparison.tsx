import type { LoanComparisonDTO } from '@fincontrol/shared';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Panel } from '../../components/ui/panel';
import { formatDate, formatRate } from '../../lib/format';

/**
 * Comparação com as taxas do Banco Central (spec C12; D1: período de referência; D3: mediana do mercado).
 * A situação vem sempre com ícone e texto, nunca só pela cor.
 */
export function RateComparison({ monthlyRate, comparison }: { monthlyRate: number; comparison: LoanComparisonDTO | null }) {
  return (
    <Panel role="region" aria-label="Comparação com o mercado" className="grid gap-3 p-5">
      <h2 className="font-display text-lg font-semibold tracking-tight">Comparação com o mercado</h2>
      {comparison === null ? (
        <p className="text-sm text-muted">Ainda não há taxas do Banco Central para comparar este tipo de crédito.</p>
      ) : (
        <>
          {monthlyRate > comparison.market.monthlyRate ? (
            <span className="inline-flex items-center gap-1.5 text-sm font-medium text-warning">
              <AlertTriangle aria-hidden className="h-4 w-4" strokeWidth={2} />
              Acima do mercado
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-sm font-medium text-income">
              <CheckCircle2 aria-hidden className="h-4 w-4" strokeWidth={2} />
              Dentro do mercado
            </span>
          )}
          <ul className="grid gap-1 text-sm">
            <li>{`Sua taxa: ${formatRate(monthlyRate)} ao mês`}</li>
            {comparison.bank && (
              <li>{`${comparison.bank.name}: ${formatRate(comparison.bank.monthlyRate)} ao mês (${comparison.bank.position}º de ${comparison.bank.of})`}</li>
            )}
            <li>{`Mediana do mercado: ${formatRate(comparison.market.monthlyRate)} ao mês`}</li>
          </ul>
          <p className="text-xs text-muted">
            {`${comparison.modality}. Fonte: ${comparison.source} · período de ${formatDate(comparison.periodStart)} a ${formatDate(comparison.periodEnd)}`}
          </p>
        </>
      )}
    </Panel>
  );
}
