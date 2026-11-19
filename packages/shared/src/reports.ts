/**
 * Regras dos relatórios (spec do sub-projeto 4, seção 3). Valores em centavos; datas `YYYY-MM-DD`; meses `YYYY-MM`.
 */
import { addMonthsToYm, dateInMonth, minDate, monthOf, type DateOnly, type YearMonth } from './dates';
import { outstandingBalance } from './loan';

export const MAX_REPORT_MONTHS = 24;
const MIN_SERIES_MONTHS = 6;

const monthIndex = (ym: YearMonth) => Number(ym.slice(0, 4)) * 12 + Number(ym.slice(5, 7)) - 1;

/** Quantos meses vão de `from` a `to`, contando os dois. */
export function monthsBetween(from: YearMonth, to: YearMonth): number {
  return monthIndex(to) - monthIndex(from) + 1;
}

/** R1 e R3: tamanho do período e o período anterior de mesmo tamanho. */
export function reportPeriod(from: YearMonth, to: YearMonth): { months: number; previousFrom: YearMonth; previousTo: YearMonth } {
  const months = monthsBetween(from, to);
  if (months < 1) throw new RangeError('O fim do período vem antes do início.');
  if (months > MAX_REPORT_MONTHS) throw new RangeError(`O período pode ter no máximo ${MAX_REPORT_MONTHS} meses.`);
  return { months, previousFrom: addMonthsToYm(from, -months), previousTo: addMonthsToYm(from, -1) };
}

/** R4: meses das séries — o período, com no mínimo 6 meses terminando em `to`. */
export function seriesMonths(from: YearMonth, to: YearMonth): YearMonth[] {
  const length = Math.max(monthsBetween(from, to), MIN_SERIES_MONTHS);
  return Array.from({ length }, (_, i) => addMonthsToYm(to, i - length + 1));
}

/** R3: variação como fração; `null` quando não havia valor anterior. */
export function changeRatio(current: number, previous: number): number | null {
  return previous === 0 ? null : (current - previous) / previous;
}

export type CardDebtInput = {
  initialBalance: number;
  /** Compras e saídas do cartão; `startDate` é a data da compra (a da 1ª parcela, para parceladas). */
  charges: { amount: number; startDate: DateOnly }[];
  /** Pagamentos de fatura e estornos. */
  credits: { amount: number; date: DateOnly }[];
};

/** Quanto se deve ao cartão no fim do dia `date`; negativo = crédito (pago a mais ou estorno depois do pagamento). */
function cardOwedAt(card: CardDebtInput, date: DateOnly): number {
  let owed = -card.initialBalance;
  for (const c of card.charges) if (c.startDate <= date) owed += c.amount;
  for (const c of card.credits) if (c.date <= date) owed -= c.amount;
  return owed;
}

/** R5: dívida do cartão no fim do dia `date`, com as parcelas futuras de compras já feitas. Mínimo 0. */
export function cardDebtAt(card: CardDebtInput, date: DateOnly): number {
  return Math.max(cardOwedAt(card, date), 0);
}

/** B1 do sub-projeto 11: o crédito que `cardDebtAt` corta no zero. É dinheiro da pessoa e entra no patrimônio. */
export function cardCreditAt(card: CardDebtInput, date: DateOnly): number {
  return Math.max(-cardOwedAt(card, date), 0);
}

export type LoanDebtInput = {
  installmentAmount: number;
  monthlyRate: number;
  installmentsTotal: number;
  installmentsPaidBefore: number;
  firstDueDate: DateOnly;
  /** Dia do cadastro: a parcela "já paga" que ainda nem venceu foi paga até ele (adiantada). */
  createdAt: DateOnly;
  /** Datas de pagamento das parcelas pagas no app. */
  paidDates: DateOnly[];
};

/**
 * R6: saldo devedor (Price, o mesmo da tela do empréstimo) no fim do dia `date`. As parcelas pagas antes do
 * cadastro contam como pagas no vencimento (ou no cadastro, se adiantadas); antes do mês anterior à 1ª parcela, o empréstimo não existia.
 */
export function loanOutstandingAt(loan: LoanDebtInput, date: DateOnly): number {
  const firstMonth = monthOf(loan.firstDueDate);
  if (monthOf(date) < addMonthsToYm(firstMonth, -1)) return 0;
  const day = Number(loan.firstDueDate.slice(8, 10));
  let paid = 0;
  for (let k = 1; k <= loan.installmentsPaidBefore; k += 1) {
    if (minDate(dateInMonth(addMonthsToYm(firstMonth, k - 1), day), loan.createdAt) <= date) paid += 1;
  }
  paid += loan.paidDates.filter((d) => d <= date).length;
  return outstandingBalance(loan.installmentAmount, loan.monthlyRate, loan.installmentsTotal - paid);
}

/** R9: célula de texto do CSV — proteção contra fórmulas e escape de `;`, aspas e quebras de linha. */
export function csvCell(text: string): string {
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return /[;"\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

/** Centavos no formato do Excel brasileiro: vírgula decimal, sem separador de milhar. */
function csvAmount(cents: number): string {
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(cents);
  return `${sign}${Math.floor(abs / 100)},${String(abs % 100).padStart(2, '0')}`;
}

export type CsvValue = string | number;

/** R9: arquivo CSV com BOM, `;` e CRLF. Números são centavos. */
export function toCsv(header: string[], rows: CsvValue[][]): string {
  const line = (cells: CsvValue[]) => cells.map((c) => (typeof c === 'number' ? csvAmount(c) : csvCell(c))).join(';');
  return `\uFEFF${[header, ...rows].map(line).join('\r\n')}\r\n`;
}

/** Os 27 caracteres que o WinAnsi (CP1252) tem entre 0x80 e 0x9F. */
const WIN_ANSI_EXTRA = new Set('€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ');
const REPLACEMENTS: Record<string, string> = { '−': '-', ' ': ' ', ' ': ' ', ' ': ' ', '\t': ' ', '\n': ' ', '\r': ' ' };

/** R10: texto que a Helvetica padrão do PDF (WinAnsi) consegue desenhar. */
export function pdfSafe(text: string): string {
  let out = '';
  // Texto colado do macOS/iOS pode vir decomposto ("e" + acento): compõe antes, senão o acento some.
  for (const ch of text.normalize('NFC')) {
    const replaced = REPLACEMENTS[ch];
    if (replaced !== undefined) {
      out += replaced;
      continue;
    }
    const code = ch.codePointAt(0)!;
    if ((code >= 0x20 && code <= 0x7e) || (code >= 0xa0 && code <= 0xff) || WIN_ANSI_EXTRA.has(ch)) out += ch;
  }
  return out;
}
