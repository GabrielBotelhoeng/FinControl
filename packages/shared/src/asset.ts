/**
 * Bens e patrimônio líquido (spec do sub-projeto 11, B3 e B8). Valores em centavos.
 * O valor de um bem nunca é guardado: sai sempre do histórico de registros.
 */
import { addMonthsToYm, endOfMonth, monthOf, type DateOnly, type YearMonth } from './dates';
import { compareByMoment } from './debt';

/** `recordedAt` (ISO) desempata dois registros no mesmo dia: vale o último gravado. */
export type AssetValuationEntry = { date: DateOnly; recordedAt: string; amount: number };
export type AssetSummary = { value: number; since: DateOnly; firstValue: number; updatedOn: DateOnly };

/** B3: valor no fim do dia `date` — o do registro mais recente até ela; antes do primeiro, 0. */
export function assetValueAt(valuations: AssetValuationEntry[], date: DateOnly): number {
  let latest: AssetValuationEntry | undefined;
  for (const v of valuations) if (v.date <= date && (!latest || compareByMoment(v, latest) > 0)) latest = v;
  return latest?.amount ?? 0;
}

/** Valor de hoje, desde quando a pessoa tem o bem (o primeiro registro) e a data da última atualização. */
export function assetSummary(valuations: AssetValuationEntry[], today: DateOnly): AssetSummary | null {
  if (valuations.length === 0) return null;
  const sorted = [...valuations].sort(compareByMoment);
  const first = sorted[0]!;
  return { value: assetValueAt(valuations, today), since: first.date, firstValue: first.amount, updatedOn: sorted[sorted.length - 1]!.date };
}

/** B8: os pontos da série, do mais antigo ao mais novo — o fim de cada mês e, no mês atual, hoje. */
export function netWorthDates(today: DateOnly, months: number): { month: YearMonth; date: DateOnly }[] {
  const current = monthOf(today);
  return Array.from({ length: months }, (_, i) => {
    const month = addMonthsToYm(current, i - months + 1);
    return { month, date: i === months - 1 ? today : endOfMonth(month) };
  });
}
