export type AccountFlows = {
  incomePaid: number;
  expensePaid: number;
  transferInPaid: number;
  transferOutPaid: number;
};

export const ZERO_FLOWS: AccountFlows = { incomePaid: 0, expensePaid: 0, transferInPaid: 0, transferOutPaid: 0 };

/** Só lançamentos pagos entram no saldo (spec 5.1). */
export function computeBalance(initialBalance: number, f: AccountFlows): number {
  return initialBalance + f.incomePaid - f.expensePaid + f.transferInPaid - f.transferOutPaid;
}

export function computeForecast(totalBalance: number, pendingIncome: number, pendingExpense: number): number {
  return totalBalance + pendingIncome - pendingExpense;
}

export function percentChange(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}
