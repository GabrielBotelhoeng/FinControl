import { z } from 'zod';
import { MAX_REPORT_MONTHS, monthsBetween } from '../reports';
import type { AccountType } from './accounts';
import { yearMonthSchema } from './common';

// ---------- Relatórios (spec do sub-projeto 4) ----------

/** R1: de 1 a 24 meses. "`to` no futuro" depende de hoje e fica no serviço. */
export const reportQuerySchema = z
  .object({ from: yearMonthSchema, to: yearMonthSchema })
  .superRefine(({ from, to }, ctx) => {
    // O Zod 4 roda o refinamento mesmo com campo inválido; sem meses válidos não há o que comparar.
    if (!yearMonthSchema.safeParse(from).success || !yearMonthSchema.safeParse(to).success) return;
    // Anos antigos demais quebrariam as datas do período anterior (ano sem 4 dígitos): o app não tem dados antes de 2000.
    if (from < '2000-01') {
      ctx.addIssue({ code: 'custom', path: ['from'], message: 'O período começa em 2000 ou depois' });
      return;
    }
    const months = monthsBetween(from, to);
    if (months < 1) ctx.addIssue({ code: 'custom', path: ['to'], message: 'O fim do período vem antes do início' });
    else if (months > MAX_REPORT_MONTHS) ctx.addIssue({ code: 'custom', path: ['to'], message: `O período pode ter no máximo ${MAX_REPORT_MONTHS} meses` });
  });

export type ReportQuery = z.output<typeof reportQuerySchema>;

/** Linha de categoria. `share` é a fração do total do período; `change` é `null` sem valor anterior (R3). */
export type ReportCategoryDTO = {
  categoryId: string;
  name: string;
  icon: string;
  color: string;
  total: number;
  share: number;
  previous: number;
  change: number | null;
};

export type ReportMonthDTO = { month: string; income: number; expense: number; net: number };
export type ReportDebtPointDTO = { month: string; cards: number; loans: number; others: number; total: number };
export type ReportExpenseDTO = { id: string; date: string; description: string; category: string; account: string; amount: number };
export type ReportBalanceDTO = { accountId: string; name: string; type: AccountType; balance: number };

export type ReportDTO = {
  period: { from: string; to: string; months: number; previousFrom: string; previousTo: string };
  totals: {
    income: number;
    expense: number;
    net: number;
    /** Fração (0,4 = 40%); `null` sem receita. */
    savingsRate: number | null;
    previousIncome: number;
    previousExpense: number;
    incomeChange: number | null;
    expenseChange: number | null;
  };
  expenseByCategory: ReportCategoryDTO[];
  incomeByCategory: ReportCategoryDTO[];
  monthly: ReportMonthDTO[];
  debts: ReportDebtPointDTO[];
  topExpenses: ReportExpenseDTO[];
  /** Saldo no fim de `to` das contas não arquivadas, sem cartões (R7). */
  balances: { date: string; items: ReportBalanceDTO[]; total: number };
};

/** R8: dívida total hoje (cartões pela R5, empréstimos pela R6). */
/** `others` = dívidas com credores (sub-projeto 6, V11). */
export type DebtsDTO = { cards: number; loans: number; others: number; total: number };
