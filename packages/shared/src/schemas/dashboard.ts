import { z } from 'zod';
import { yearMonthSchema } from './common';
import type { BudgetSummaryDTO } from './planning';
import type { DebtsDTO } from './reports';
import type { TransactionDTO } from './transactions';

export const summaryQuerySchema = z.object({ month: yearMonthSchema.optional() });
export const byCategoryQuerySchema = z.object({ month: yearMonthSchema.optional() });
export const evolutionQuerySchema = z.object({ months: z.coerce.number().int().min(1).max(12).default(6) });

export type MonthComparison = { current: number; previous: number; changePercent: number | null };

export type DashboardSummaryDTO = {
  month: string;
  totalBalance: number;
  forecastEndOfMonth: number;
  income: MonthComparison;
  expense: MonthComparison;
  pendingCount: number;
  overdueCount: number;
  upcoming: UpcomingItemDTO[];
  health: FinancialHealthDTO;
  /** Orçamento do mês (spec sub-projeto 3, P10); `null` sem nenhum limite. */
  budget: BudgetSummaryDTO | null;
  /** Total de dívidas hoje (spec sub-projeto 4, R8). */
  debts: DebtsDTO;
  /** Patrimônio líquido hoje (spec sub-projeto 11, B1 e B9): contas sem cartões + bens − dívidas. */
  netWorth: number;
};

/** Item de lançamento em "A pagar" (decisão R16): o `TransactionDTO` de sempre, mais o discriminante. */
export type UpcomingTransactionDTO = TransactionDTO & { kind: 'transaction' };

/**
 * Item de fatura de cartão em "A pagar" (decisão R16): faturas `closed` ou `overdue` com restante > 0,
 * inclusive de cartão arquivado. `remaining` é `amount − paid` (já líquido, mínimo 0). `status` vem do
 * servidor (spec C4, `invoiceStatus`) — fonte única da situação; a web não recalcula a partir de `dueDate`
 * (decisão R26).
 */
export type UpcomingInvoiceDTO = {
  kind: 'invoice';
  cardId: string;
  cardName: string;
  month: string;
  dueDate: string;
  remaining: number;
  status: 'closed' | 'overdue';
};

export type UpcomingItemDTO = UpcomingTransactionDTO | UpcomingInvoiceDTO;

/** Indicadores de saúde financeira. Valores em centavos; `savingsRate` e `debtCommitment` são fração (0,2 = 20%). */
export type FinancialHealthDTO = {
  savingsRate: number | null;
  reserveMonths: number | null;
  liquidBalance: number;
  averageMonthlyExpense: number | null;
  debtCommitment: number | null;
  debtPayments: number;
};

/** Primeiros passos (sub-projeto 12, G2): cada passo está feito quando existe pelo menos um registro dele. */
export type OnboardingDTO = { account: boolean; transaction: boolean; budget: boolean; goal: boolean };

export type EvolutionPointDTO = { month: string; income: number; expense: number; endBalance: number };
export type CategorySpendDTO = { categoryId: string; name: string; icon: string; color: string; total: number };
