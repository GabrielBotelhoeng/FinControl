import { z } from 'zod';
import { yearMonthSchema } from './common';
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
};

/** Item de lançamento em "A pagar" (decisão R16): o `TransactionDTO` de sempre, mais o discriminante. */
export type UpcomingTransactionDTO = TransactionDTO & { kind: 'transaction' };

/**
 * Item de fatura de cartão em "A pagar" (decisão R16): faturas `closed` ou `overdue` com restante > 0,
 * inclusive de cartão arquivado. `remaining` é `amount − paid` (já líquido, mínimo 0).
 */
export type UpcomingInvoiceDTO = {
  kind: 'invoice';
  cardId: string;
  cardName: string;
  month: string;
  dueDate: string;
  remaining: number;
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

export type EvolutionPointDTO = { month: string; income: number; expense: number; endBalance: number };
export type CategorySpendDTO = { categoryId: string; name: string; icon: string; color: string; total: number };
