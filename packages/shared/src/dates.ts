/** Data de negócio sem hora, no formato YYYY-MM-DD. */
export type DateOnly = string;
/** Ano-mês no formato YYYY-MM. */
export type YearMonth = string;

export const TIME_ZONE = 'America/Sao_Paulo';

const todayFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit',
});

const pad2 = (n: number) => String(n).padStart(2, '0');
const toUTC = (d: DateOnly) => new Date(`${d}T00:00:00.000Z`);
const fromUTC = (d: Date): DateOnly => d.toISOString().slice(0, 10);

function parseYm(ym: YearMonth): [number, number] {
  return [Number(ym.slice(0, 4)), Number(ym.slice(5, 7))];
}

export function todayInSaoPaulo(now: Date = new Date()): DateOnly {
  return todayFormatter.format(now);
}

export function isValidDateOnly(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = toUTC(s);
  return !Number.isNaN(d.getTime()) && fromUTC(d) === s;
}

export function addDays(d: DateOnly, n: number): DateOnly {
  const x = toUTC(d);
  x.setUTCDate(x.getUTCDate() + n);
  return fromUTC(x);
}

export function daysInMonth(year: number, month1: number): number {
  return new Date(Date.UTC(year, month1, 0)).getUTCDate();
}

export function monthOf(d: DateOnly): YearMonth {
  return d.slice(0, 7);
}

export function startOfMonth(ym: YearMonth): DateOnly {
  return `${ym}-01`;
}

export function endOfMonth(ym: YearMonth): DateOnly {
  const [y, m] = parseYm(ym);
  return `${ym}-${pad2(daysInMonth(y, m))}`;
}

export function addMonthsToYm(ym: YearMonth, n: number): YearMonth {
  const [y, m] = parseYm(ym);
  const index = y * 12 + (m - 1) + n;
  return `${Math.floor(index / 12)}-${pad2((index % 12) + 1)}`;
}

export function dateInMonth(ym: YearMonth, day: number): DateOnly {
  const [y, m] = parseYm(ym);
  return `${ym}-${pad2(Math.min(day, daysInMonth(y, m)))}`;
}

export function minDate(a: DateOnly, b: DateOnly): DateOnly {
  return a < b ? a : b;
}

export function maxDate(a: DateOnly, b: DateOnly): DateOnly {
  return a > b ? a : b;
}
