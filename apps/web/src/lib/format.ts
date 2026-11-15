import { formatBRL, type DateOnly, type TransactionType, type YearMonth } from '@fincontrol/shared';

export { formatBRL };

const monthFormatter = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' });
const MINUS = '−';

// Mesma lista de abreviações da API (cards.service.ts, invoiceLabel): evita depender do Intl (ICU varia por
// ambiente) para um formato que precisa ser exatamente "dez/2026" (decisão do controlador, Tarefa 11).
const MONTH_ABBREV = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'] as const;

export function formatDate(d: DateOnly): string {
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y}`;
}

export function formatMonthLabel(ym: YearMonth): string {
  return monthFormatter.format(new Date(`${ym}-01T00:00:00Z`));
}

/** "2026-12" → "dez/2026" (mês abreviado em pt-BR, minúsculo, e o ano). */
export function formatMonthShort(ym: YearMonth): string {
  const [year, month] = ym.split('-');
  return `${MONTH_ABBREV[Number(month) - 1]}/${year}`;
}

export function formatSignedBRL(cents: number, type: TransactionType): string {
  const value = formatBRL(Math.abs(cents));
  if (type === 'income') return `+${value}`;
  if (type === 'expense') return `${MINUS}${value}`;
  return value;
}

/** Divide o valor para o saldo herói: "R$" e centavos em peso fino, inteiros em extra-negrito. */
export function splitBRL(cents: number): { sign: string; currency: string; integer: string; cents: string } {
  const formatted = formatBRL(Math.abs(cents)).replace(/\s/g, ' ');
  const [, number = '0,00'] = formatted.split(' ');
  const [integer = '0', decimals = '00'] = number.split(',');
  return { sign: cents < 0 ? MINUS : '', currency: 'R$', integer, cents: `,${decimals}` };
}
