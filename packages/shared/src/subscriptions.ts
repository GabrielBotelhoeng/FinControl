/**
 * Gastos que se repetem (sub-projeto 10, S1–S3): acha, nas despesas pagas, o que se repete todo mês com valor
 * parecido — assinaturas e contas que a pessoa talvez nem lembre que paga. Valores em centavos.
 */
import { addDays, monthOf, type DateOnly } from './dates';
import { normalizeDescription } from './statement';

export type SpendingInput = { description: string; amount: number; date: DateOnly; recurring: boolean };
export type RepeatedSpending = {
  description: string;
  /** Média dos últimos pagamentos. */
  monthly: number;
  yearly: number;
  months: number;
  lastDate: DateOnly;
  nextDate: DateOnly;
  /** Já é uma recorrência cadastrada no app. */
  recurring: boolean;
};

/** S1: pelo menos 3 meses diferentes, valores a até 15% da mediana e no máximo um pagamento por mês. */
export function detectRepeatedSpending(items: SpendingInput[]): RepeatedSpending[] {
  const groups = new Map<string, SpendingInput[]>();
  for (const i of items) {
    const key = normalizeDescription(i.description);
    if (!key) continue;
    groups.set(key, [...(groups.get(key) ?? []), i]);
  }
  const out: RepeatedSpending[] = [];
  for (const list of groups.values()) {
    const sorted = [...list].sort((a, b) => (a.date < b.date ? -1 : 1));
    const months = new Set(sorted.map((i) => monthOf(i.date)));
    if (months.size < 3 || months.size !== sorted.length) continue;
    const amounts = sorted.map((i) => i.amount).sort((a, b) => a - b);
    const mid = Math.floor(amounts.length / 2);
    // Quantidade par: a média dos dois do meio (CodeRabbit).
    const median = amounts.length % 2 === 0 ? (amounts[mid - 1]! + amounts[mid]!) / 2 : amounts[mid]!;
    if (amounts.some((a) => Math.abs(a - median) > median * 0.15)) continue;
    const recent = sorted.slice(-3);
    const monthly = Math.round(recent.reduce((s, i) => s + i.amount, 0) / recent.length);
    const last = sorted.at(-1)!;
    out.push({
      description: last.description,
      monthly,
      yearly: monthly * 12,
      months: months.size,
      lastDate: last.date,
      nextDate: addDays(last.date, 30),
      recurring: sorted.some((i) => i.recurring),
    });
  }
  // S2: do mais caro para o mais barato.
  return out.sort((a, b) => b.monthly - a.monthly);
}
