/**
 * Empréstimos em tabela Price (spec C8, C9 e C11). Valores em centavos; taxas como fração (0,02 = 2% ao mês).
 * Referência: skills `lending` e `time-value-of-money`.
 */
export type LoanWarning = 'informed_rate_differs' | 'rate_too_high' | 'sac_approximate';
export type LoanSummary = {
  monthlyRate: number; annualRate: number; totalCost: number; interest: number;
  paidAmount: number; remainingCount: number; outstanding: number; payoffSavings: number;
};

const presentValue = (installment: number, i: number, n: number) => (i === 0 ? installment * n : (installment * (1 - (1 + i) ** -n)) / i);

/** Taxa mensal que faz `principal = PV(parcela, i, n)`. Bisseção em [0, 100% a.m.], precisão de 1e-10; sem juros → 0. */
export function impliedMonthlyRate(principal: number, installment: number, n: number): number {
  if (installment * n <= principal) return 0;
  let lo = 0;
  let hi = 1;
  while (hi - lo > 1e-10) {
    const mid = (lo + hi) / 2;
    if (presentValue(installment, mid, n) > principal) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

export const annualRate = (monthly: number) => (1 + monthly) ** 12 - 1;

/** Saldo devedor = quitação estimada (CDC art. 52 §2º): valor presente das parcelas restantes. */
export function outstandingBalance(installment: number, monthly: number, remaining: number): number {
  return remaining <= 0 ? 0 : Math.round(presentValue(installment, monthly, remaining));
}

export function loanSummary(l: { principal: number; installmentAmount: number; installmentsTotal: number; installmentsPaid: number }): LoanSummary {
  const monthlyRate = impliedMonthlyRate(l.principal, l.installmentAmount, l.installmentsTotal);
  const totalCost = l.installmentAmount * l.installmentsTotal;
  const remainingCount = Math.max(l.installmentsTotal - l.installmentsPaid, 0);
  const outstanding = outstandingBalance(l.installmentAmount, monthlyRate, remainingCount);
  return {
    monthlyRate, annualRate: annualRate(monthlyRate), totalCost, interest: totalCost - l.principal,
    paidAmount: l.installmentAmount * l.installmentsPaid, remainingCount, outstanding,
    payoffSavings: l.installmentAmount * remainingCount - outstanding,
  };
}

/** Avisos do cadastro (spec C8, C9 e seção 8). */
export function loanWarnings(i: { monthlyRate: number; informedMonthlyRate: number | null; kind: string }): LoanWarning[] {
  const out: LoanWarning[] = [];
  if (i.informedMonthlyRate !== null && Math.abs(i.monthlyRate - i.informedMonthlyRate) > 0.001) out.push('informed_rate_differs');
  if (i.monthlyRate > 0.3) out.push('rate_too_high');
  if (i.kind === 'mortgage') out.push('sac_approximate');
  return out;
}
