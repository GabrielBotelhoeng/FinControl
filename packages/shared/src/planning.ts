import type { DateOnly } from './dates';

/** Faixa do orçamento pela porcentagem exibida (P3): até 79% dentro, 80–100% perto, acima de 100% estourou. */
export function budgetStatus(committed: number, limit: number): { percent: number; status: 'ok' | 'near' | 'over' } {
  const percent = Math.round((committed / limit) * 100);
  return { percent, status: percent > 100 ? 'over' : percent >= 80 ? 'near' : 'ok' };
}

/** Média do gasto pago nos meses com gasto, para cima em R$ 10 (P4); sem gasto, sem sugestão. */
export function suggestedLimit(monthlyPaid: number[]): number | null {
  const withSpend = monthlyPaid.filter((v) => v > 0);
  if (withSpend.length === 0) return null;
  const average = withSpend.reduce((s, v) => s + v, 0) / withSpend.length;
  return Math.ceil(average / 1000) * 1000;
}

const monthIndex = (d: DateOnly) => Number(d.slice(0, 4)) * 12 + Number(d.slice(5, 7)) - 1;
const dayNumber = (d: DateOnly) => Date.UTC(Number(d.slice(0, 4)), Number(d.slice(5, 7)) - 1, Number(d.slice(8, 10))) / 86_400_000;

/** Meses de calendário do mês atual ao mês do prazo, contando os dois; mínimo 1. */
export function monthsUntil(today: DateOnly, targetDate: DateOnly): number {
  return Math.max(monthIndex(targetDate) - monthIndex(today) + 1, 1);
}

/** Progresso da meta (P7). Sem rendimento nem inflação. */
export function goalProgress(g: { target: number; saved: number; createdAt: DateOnly; targetDate: DateOnly; today: DateOnly }) {
  const fraction = Math.min(Math.max(g.saved / g.target, 0), 1);
  const monthsLeft = monthsUntil(g.today, g.targetDate);
  const remaining = Math.max(g.target - g.saved, 0);
  if (remaining === 0) return { fraction, status: 'reached' as const, monthlyNeeded: 0, monthsLeft };
  if (g.today > g.targetDate) return { fraction, status: 'overdue' as const, monthlyNeeded: remaining, monthsLeft };
  const total = Math.max(dayNumber(g.targetDate) - dayNumber(g.createdAt), 1);
  const expected = Math.min(Math.max((dayNumber(g.today) - dayNumber(g.createdAt)) / total, 0), 1);
  const status = fraction >= expected - 0.01 ? ('on_track' as const) : ('late' as const);
  return { fraction, status, monthlyNeeded: Math.ceil(remaining / monthsLeft), monthsLeft };
}
