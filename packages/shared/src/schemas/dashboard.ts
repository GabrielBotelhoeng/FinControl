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
  upcoming: TransactionDTO[];
  health: FinancialHealthDTO;
};

/** Indicadores de saúde financeira. Valores em centavos; `savingsRate` é fração (0,2 = 20%). */
export type FinancialHealthDTO = {
  savingsRate: number | null;
  reserveMonths: number | null;
  liquidBalance: number;
  averageMonthlyExpense: number | null;
};

export type EvolutionPointDTO = { month: string; income: number; expense: number; endBalance: number };
export type CategorySpendDTO = { categoryId: string; name: string; icon: string; color: string; total: number };
