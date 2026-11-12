/**
 * Indicadores de saúde financeira (docs/skills-no-fincontrol.md, seção 1).
 * Referências: skills `savings-goals` e `emergency-fund`; metas de mercado de 10–20% de poupança e 3–6 meses de reserva.
 */

/** Parte da receita do mês que sobrou (0,2 = 20%). Sem receita, não há taxa. */
export function savingsRate(income: number, expense: number): number | null {
  if (income <= 0) return null;
  return Math.round(((income - expense) / income) * 1000) / 1000;
}

/**
 * Quantos meses o saldo líquido cobre o gasto médio (abordagem conservadora: gasto total, não só o essencial).
 * Meses sem despesa ficam fora da média, para não inflar a reserva de quem começou a usar o app agora.
 */
export function reserveCoverage(liquidBalance: number, monthlyExpenses: number[]): { months: number | null; averageExpense: number | null } {
  const withSpending = monthlyExpenses.filter((e) => e > 0);
  if (withSpending.length === 0) return { months: null, averageExpense: null };
  const averageExpense = Math.round(withSpending.reduce((sum, e) => sum + e, 0) / withSpending.length);
  const months = liquidBalance <= 0 ? 0 : Math.round((liquidBalance / averageExpense) * 10) / 10;
  return { months, averageExpense };
}

/** Parte da renda média comprometida com parcelas de dívida (spec C13). Meses sem receita ficam fora da média. */
export function debtCommitment(debtPayments: number, monthlyIncomes: number[]): number | null {
  const withIncome = monthlyIncomes.filter((v) => v > 0);
  if (withIncome.length === 0) return null;
  const average = withIncome.reduce((s, v) => s + v, 0) / withIncome.length;
  return Math.round((debtPayments / average) * 1000) / 1000;
}
