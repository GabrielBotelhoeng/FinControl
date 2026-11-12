import type { FinancialHealthDTO } from '@fincontrol/shared';
import { AlertTriangle, CheckCircle2, CircleSlash, type LucideIcon } from 'lucide-react';
import { Panel } from '../../components/ui/panel';
import { formatBRL } from '../../lib/format';

type Status = { label: string; tone: 'good' | 'warning' | 'critical'; icon: LucideIcon };

// Status sempre com ícone e texto (nunca só cor), nos tokens semânticos do design system.
const TONE: Record<Status['tone'], string> = { good: 'text-income', warning: 'text-warning', critical: 'text-expense' };

const percent = new Intl.NumberFormat('pt-BR', { style: 'percent', maximumFractionDigits: 0 });
const decimal = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 });

/** Meta de 20% (referências de mercado e skill `savings-goals`; mínimo recomendado 10%). */
function savingsStatus(rate: number): Status {
  // Mesmo arredondamento do número exibido (inteiro), para o rótulo nunca contradizer a tela (ex.: 19,5% mostra "20%").
  const shown = Math.round(rate * 100);
  if (shown >= 20) return { label: 'Na meta', tone: 'good', icon: CheckCircle2 };
  if (shown >= 0) return { label: 'Abaixo da meta', tone: 'warning', icon: AlertTriangle };
  return { label: 'Gastou mais do que ganhou', tone: 'critical', icon: CircleSlash };
}

/** Meta de 3 a 6 meses do gasto (skill `emergency-fund`). */
function reserveStatus(months: number): Status {
  if (months >= 6) return { label: 'Reserva completa', tone: 'good', icon: CheckCircle2 };
  if (months >= 3) return { label: 'Na meta', tone: 'good', icon: CheckCircle2 };
  if (months >= 1) return { label: 'Abaixo da meta', tone: 'warning', icon: AlertTriangle };
  return { label: 'Reserva baixa', tone: 'critical', icon: CircleSlash };
}

function Tile({ label, value, status, goal, detail }: { label: string; value: string; status: Status | null; goal: string; detail: string }) {
  const Icon = status?.icon;
  return (
    <Panel role="group" aria-label={label} className="flex min-w-0 flex-col gap-2 p-5">
      <span className="text-sm text-muted">{label}</span>
      <span data-metric-value className="tabular font-display text-3xl font-bold tracking-tight text-text">
        {value}
      </span>
      {status && Icon && (
        <span className={`inline-flex items-center gap-1.5 text-sm font-medium ${TONE[status.tone]}`}>
          <Icon aria-hidden className="h-4 w-4" strokeWidth={2} />
          {status.label}
        </span>
      )}
      <span className="text-xs leading-relaxed text-muted">
        {goal}
        <br />
        {detail}
      </span>
    </Panel>
  );
}

export function HealthTiles({ health }: { health: FinancialHealthDTO }) {
  const { savingsRate, reserveMonths, liquidBalance, averageMonthlyExpense } = health;
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Tile
        label="Taxa de poupança"
        value={savingsRate === null ? '—' : percent.format(savingsRate)}
        status={savingsRate === null ? null : savingsStatus(savingsRate)}
        goal="Meta: guardar 20% da renda (mínimo recomendado: 10%)."
        detail={savingsRate === null ? 'Sem receitas pagas neste mês.' : 'Quanto da receita paga do mês sobrou depois das despesas pagas.'}
      />
      <Tile
        label="Reserva de emergência"
        value={reserveMonths === null ? '—' : `${decimal.format(reserveMonths)} ${reserveMonths >= 2 ? 'meses' : 'mês'}`}
        status={reserveMonths === null ? null : reserveStatus(reserveMonths)}
        goal="Meta: 3 a 6 meses do seu gasto médio."
        detail={
          averageMonthlyExpense === null
            ? 'Lance suas despesas por um mês completo para calcular.'
            : `Hoje: ${formatBRL(liquidBalance)} em conta corrente, poupança e carteira ÷ gasto médio de ${formatBRL(averageMonthlyExpense)} nos últimos 3 meses.`
        }
      />
    </div>
  );
}
