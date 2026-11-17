import { addMonthsToYm, type YearMonth } from '@fincontrol/shared';

/** R1: os três atalhos da tela. */
export type PeriodMode = 'mes' | 'ano' | '12m';

export const PERIOD_OPTIONS: { value: PeriodMode; label: string }[] = [
  { value: 'mes', label: 'Mês' },
  { value: 'ano', label: 'Ano' },
  { value: '12m', label: '12 meses' },
];

/** O ano vai de janeiro até dezembro, ou até o mês atual no ano corrente (a API recusa meses futuros). */
export function periodRange(mode: PeriodMode, month: YearMonth, year: number, current: YearMonth): { from: YearMonth; to: YearMonth } {
  if (mode === 'mes') return { from: month, to: month };
  if (mode === '12m') return { from: addMonthsToYm(current, -11), to: current };
  const december = `${year}-12`;
  return { from: `${year}-01`, to: december > current ? current : december };
}
