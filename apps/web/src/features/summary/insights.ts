import { addMonthsToYm, type BudgetMonthDTO, type ReportDTO, type YearMonth } from '@fincontrol/shared';
import { formatBRL, formatDate, formatMonthLabel } from '../../lib/format';

export type InsightTone = 'good' | 'bad' | 'neutral';
export type Insight = { id: string; tone: InsightTone; title: string; detail: string | null };

const pct = (fraction: number) => `${Math.round(Math.abs(fraction) * 100)}%`;

/**
 * Resumo do mês (sub-projeto 8, M1–M3): frases curtas a partir do relatório de um mês e do orçamento.
 * Só entra o que tem dado; a ordem é a de leitura (gastos, sobra, categorias, maior despesa, orçamento, dívidas).
 */
export function monthInsights(month: YearMonth, report: ReportDTO, budget: BudgetMonthDTO | null): Insight[] {
  const out: Insight[] = [];
  const t = report.totals;
  const previous = formatMonthLabel(addMonthsToYm(month, -1));

  if (t.expense > 0 || t.previousExpense > 0) {
    const change = t.expenseChange;
    out.push({
      id: 'expense',
      tone: change === null ? 'neutral' : change > 0 ? 'bad' : 'good',
      title: `Você gastou ${formatBRL(t.expense)}`,
      detail:
        change === null
          ? `Sem gastos registrados em ${previous} para comparar.`
          : change === 0
            ? `O mesmo que em ${previous}.`
            : `${pct(change)} ${change > 0 ? 'a mais' : 'a menos'} que em ${previous} (${formatBRL(t.previousExpense)}).`,
    });
  }

  if (t.income > 0 || t.expense > 0) {
    out.push(
      t.net >= 0
        ? {
            // Positivo só a partir da meta de 20%; abaixo dela, sobrar é bom mas não é motivo de comemorar (revisão final).
            id: 'net', tone: t.savingsRate !== null && t.savingsRate >= 0.2 ? 'good' : 'neutral', title: `Sobrou ${formatBRL(t.net)}`,
            detail: t.savingsRate !== null ? `Você guardou ${pct(t.savingsRate)} do que entrou. A meta saudável é 20%.` : null,
          }
        : { id: 'net', tone: 'bad', title: `Faltou ${formatBRL(-t.net)}`, detail: 'Você gastou mais do que recebeu no mês.' },
    );
  }

  const moves = report.expenseByCategory.map((c) => ({ c, diff: c.total - c.previous })).filter((x) => x.diff !== 0);
  const up = moves.filter((x) => x.diff > 0).sort((a, b) => b.diff - a.diff)[0];
  const down = moves.filter((x) => x.diff < 0).sort((a, b) => a.diff - b.diff)[0];
  if (up) {
    out.push({
      id: 'up', tone: 'bad', title: `${up.c.name} subiu ${formatBRL(up.diff)}`,
      detail: up.c.previous > 0 ? `De ${formatBRL(up.c.previous)} para ${formatBRL(up.c.total)} (+${pct(up.diff / up.c.previous)}).` : `Não teve gasto nessa categoria em ${previous}.`,
    });
  }
  if (down) {
    out.push({
      id: 'down', tone: 'good', title: `${down.c.name} caiu ${formatBRL(-down.diff)}`,
      detail: `De ${formatBRL(down.c.previous)} para ${formatBRL(down.c.total)}.`,
    });
  }

  const top = report.topExpenses[0];
  if (top) {
    out.push({ id: 'top', tone: 'neutral', title: `Maior despesa: ${top.description}`, detail: `${formatBRL(top.amount)} em ${formatDate(top.date)}, em ${top.category}.` });
  }

  if (budget && budget.items.length > 0) {
    const over = budget.items.filter((i) => i.status === 'over');
    const near = budget.items.filter((i) => i.status === 'near');
    out.push(
      over.length > 0
        ? { id: 'budget', tone: 'bad', title: `${over.length} ${over.length === 1 ? 'categoria estourou' : 'categorias estouraram'} o limite`, detail: over.map((i) => i.name).join(', ') }
        : {
            id: 'budget', tone: 'good', title: 'Todas as categorias dentro do limite',
            detail: near.length > 0 ? `Perto do limite: ${near.map((i) => i.name).join(', ')}.` : null,
          },
    );
  }

  const [before, after] = report.debts.slice(-2);
  if (before && after && (before.total > 0 || after.total > 0)) {
    const diff = after.total - before.total;
    out.push({
      id: 'debts',
      tone: diff < 0 ? 'good' : diff > 0 ? 'bad' : 'neutral',
      title: diff < 0 ? `Suas dívidas caíram ${formatBRL(-diff)}` : diff > 0 ? `Suas dívidas subiram ${formatBRL(diff)}` : 'Suas dívidas ficaram iguais',
      detail: `Total no fim do mês: ${formatBRL(after.total)}.`,
    });
  }
  return out;
}
