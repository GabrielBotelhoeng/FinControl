import { addDays, changeRatio, type DateOnly, type TransactionNature } from '@fincontrol/shared';

/**
 * Análises da planilha (spec da exportação em Excel, E5–E9). Funções puras sobre as despesas pagas do período.
 * Valores em centavos.
 */
export type AnalysisExpense = { description: string; amount: number; date: DateOnly; category: string; nature: TransactionNature | null };

const MAX_DESCRIPTIONS = 50;
const SMALL_LIMIT = 5000;
const HIGHLIGHT_RATIO = 0.2;
const WEEKDAYS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

/** E5: sem acento, minúsculas, sem "(3/10)" de parcela e com os espaços juntos. */
export function normalizeDescription(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\(\s*\d+\s*\/\s*\d+\s*\)/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const mostCommon = (values: string[]) => {
  const count = new Map<string, number>();
  for (const v of values) count.set(v, (count.get(v) ?? 0) + 1);
  return [...count.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'pt-BR'))[0]![0];
};

export type DescriptionRow = { label: string; count: number; total: number; average: number; category: string; lastDate: DateOnly };

/** E5: agrupa pela descrição normalizada; o rótulo é a forma escrita mais comum, sem o número da parcela. */
export function byDescription(expenses: AnalysisExpense[]): DescriptionRow[] {
  const groups = new Map<string, AnalysisExpense[]>();
  for (const e of expenses) {
    const key = normalizeDescription(e.description);
    groups.set(key, [...(groups.get(key) ?? []), e]);
  }
  return [...groups.values()]
    .map((list) => {
      const total = list.reduce((s, e) => s + e.amount, 0);
      return {
        label: mostCommon(list.map((e) => e.description.replace(/\(\s*\d+\s*\/\s*\d+\s*\)/g, '').replace(/\s+/g, ' ').trim())),
        count: list.length,
        total,
        average: Math.round(total / list.length),
        category: mostCommon(list.map((e) => e.category)),
        lastDate: list.map((e) => e.date).sort().at(-1)!,
      };
    })
    .sort((a, b) => b.total - a.total || b.count - a.count || a.label.localeCompare(b.label, 'pt-BR'))
    .slice(0, MAX_DESCRIPTIONS);
}

const weekdayOf = (d: DateOnly) => new Date(`${d}T00:00:00Z`).getUTCDay();

export type WeekdayAnalysis = {
  days: { weekday: string; count: number; total: number; average: number }[];
  weekend: { total: number; days: number; perDay: number };
  weekdays: { total: number; days: number; perDay: number };
};

/** E7: por dia da semana e "fim de semana × dias úteis" pela média diária (total ÷ quantos desses dias o período tem). */
export function byWeekday(expenses: AnalysisExpense[], from: DateOnly, to: DateOnly): WeekdayAnalysis {
  const total = Array(7).fill(0) as number[];
  const count = Array(7).fill(0) as number[];
  for (const e of expenses) {
    const w = weekdayOf(e.date);
    total[w]! += e.amount;
    count[w]! += 1;
  }
  let weekendDays = 0;
  let weekDays = 0;
  for (let d = from; d <= to; d = addDays(d, 1)) {
    const w = weekdayOf(d);
    if (w === 0 || w === 6) weekendDays += 1;
    else weekDays += 1;
  }
  const weekendTotal = total[0]! + total[6]!;
  const weekTotal = total.reduce((s, v) => s + v, 0) - weekendTotal;
  return {
    days: WEEKDAYS.map((weekday, i) => ({ weekday, count: count[i]!, total: total[i]!, average: count[i] ? Math.round(total[i]! / count[i]!) : 0 })),
    weekend: { total: weekendTotal, days: weekendDays, perDay: weekendDays ? Math.round(weekendTotal / weekendDays) : 0 },
    weekdays: { total: weekTotal, days: weekDays, perDay: weekDays ? Math.round(weekTotal / weekDays) : 0 },
  };
}

/** E8: despesas abaixo de R$ 50, por categoria, e quanto isso dá por mês. */
export function smallExpenses(expenses: AnalysisExpense[], months: number) {
  const small = expenses.filter((e) => e.amount < SMALL_LIMIT);
  const byCategory = new Map<string, { count: number; total: number }>();
  for (const e of small) {
    const slot = byCategory.get(e.category) ?? { count: 0, total: 0 };
    slot.count += 1;
    slot.total += e.amount;
    byCategory.set(e.category, slot);
  }
  const total = small.reduce((s, e) => s + e.amount, 0);
  return {
    items: [...byCategory.entries()].map(([category, v]) => ({ category, ...v })).sort((a, b) => b.total - a.total || a.category.localeCompare(b.category, 'pt-BR')),
    count: small.length,
    total,
    perMonth: Math.round(total / Math.max(months, 1)),
  };
}

/** E9: soma por natureza, com a participação. */
export function fixedVsVariable(expenses: AnalysisExpense[]) {
  const sum = (n: TransactionNature | null) => expenses.filter((e) => e.nature === n).reduce((s, e) => s + e.amount, 0);
  const rows = [
    { nature: 'Fixas', total: sum('fixed') },
    { nature: 'Variáveis', total: sum('variable') },
    { nature: 'Sem natureza', total: sum(null) },
  ];
  const all = rows.reduce((s, r) => s + r.total, 0);
  return rows.map((r) => ({ ...r, share: all ? r.total / all : 0 }));
}

/**
 * E6: média mensal de cada categoria no período (`months` meses) contra a média dos 3 meses anteriores ao início.
 * Destaque quando subiu mais de 20%.
 */
export function aboveAverage(current: Map<string, number>, previous3: Map<string, number>, months: number) {
  const names = [...new Set([...current.keys(), ...previous3.keys()])];
  return names
    .map((category) => {
      const monthly = Math.round((current.get(category) ?? 0) / Math.max(months, 1));
      const previousMonthly = Math.round((previous3.get(category) ?? 0) / 3);
      const change = changeRatio(monthly, previousMonthly);
      return { category, monthly, previousMonthly, change, highlight: change !== null && change > HIGHLIGHT_RATIO };
    })
    .sort((a, b) => b.monthly - a.monthly || b.previousMonthly - a.previousMonthly || a.category.localeCompare(b.category, 'pt-BR'));
}
