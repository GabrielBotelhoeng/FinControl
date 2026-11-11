import { formatBRL, type DateOnly, type TransactionType, type YearMonth } from '@fincontrol/shared';

export { formatBRL };

const monthFormatter = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' });
const MINUS = '−';

export function formatDate(d: DateOnly): string {
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y}`;
}

export function formatMonthLabel(ym: YearMonth): string {
  return monthFormatter.format(new Date(`${ym}-01T00:00:00Z`));
}

export function formatSignedBRL(cents: number, type: TransactionType): string {
  const value = formatBRL(Math.abs(cents));
  if (type === 'income') return `+${value}`;
  if (type === 'expense') return `${MINUS}${value}`;
  return value;
}

/** Divide o valor para o saldo herói: "R$" e centavos em peso fino, inteiros em extra-negrito. */
export function splitBRL(cents: number): { sign: string; currency: string; integer: string; cents: string } {
  const formatted = formatBRL(Math.abs(cents)).replace(/ /g, ' ');
  const [, number = '0,00'] = formatted.split(' ');
  const [integer = '0', decimals = '00'] = number.split(',');
  return { sign: cents < 0 ? MINUS : '', currency: 'R$', integer, cents: `,${decimals}` };
}
