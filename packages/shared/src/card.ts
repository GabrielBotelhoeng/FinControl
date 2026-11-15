import { addMonthsToYm, dateInMonth, monthOf, type DateOnly, type YearMonth } from './dates';

/** Fechamento e vencimento de uma fatura (spec C3). Vencimento antes do fechamento no calendário = mês seguinte ao fechamento. */
export function invoiceDates(invoiceMonth: YearMonth, closingDay: number, dueDay: number): { closingDate: DateOnly; dueDate: DateOnly } {
  const closingMonth = dueDay > closingDay ? invoiceMonth : addMonthsToYm(invoiceMonth, -1);
  return { closingDate: dateInMonth(closingMonth, closingDay), dueDate: dateInMonth(invoiceMonth, dueDay) };
}

/** Fatura em que a compra cai: até o fechamento (inclusive), a que fecha no mês da compra; depois, a seguinte. */
export function invoiceFor(purchase: DateOnly, closingDay: number, dueDay: number) {
  const purchaseMonth = monthOf(purchase);
  const closingMonth = purchase <= dateInMonth(purchaseMonth, closingDay) ? purchaseMonth : addMonthsToYm(purchaseMonth, 1);
  const invoiceMonth = dueDay > closingDay ? closingMonth : addMonthsToYm(closingMonth, 1);
  return { invoiceMonth, ...invoiceDates(invoiceMonth, closingDay, dueDay) };
}

/** Divide em n parcelas inteiras; a 1ª leva o resto (spec C5). */
export function splitInstallments(totalCents: number, n: number): number[] {
  const base = Math.floor(totalCents / n);
  return Array.from({ length: n }, (_, i) => (i === 0 ? base + (totalCents - base * n) : base));
}

/** Data em que a parcela k conta como gasto (spec C1). */
export function installmentDate(purchase: DateOnly, k: number): DateOnly {
  return dateInMonth(addMonthsToYm(monthOf(purchase), k - 1), Number(purchase.slice(8, 10)));
}

/** Situação da fatura (spec C4). */
export function invoiceStatus(i: { today: DateOnly; closingDate: DateOnly; dueDate: DateOnly; amount: number; paid: number }) {
  if (i.today < i.closingDate) return 'open' as const;
  if (i.paid >= i.amount) return 'paid' as const;
  return i.today > i.dueDate ? ('overdue' as const) : ('closed' as const);
}
