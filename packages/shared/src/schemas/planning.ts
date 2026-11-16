import { z } from 'zod';
import { MAX_CENTS } from '../money';
import { centsSchema, dateOnlySchema, nameSchema, NON_EMPTY_MESSAGE, nonEmpty, yearMonthSchema } from './common';

// ---------- Orçamento (spec P1–P5) ----------

export const setBudgetSchema = z.object({ limit: centsSchema });
export const budgetQuerySchema = z.object({ month: yearMonthSchema.optional() });
export const forecastQuerySchema = z.object({ months: z.coerce.number().int().min(1).max(12).default(3) });

export type SetBudgetInput = z.output<typeof setBudgetSchema>;
export type BudgetStatus = 'ok' | 'near' | 'over';

/** Categoria com limite no mês. Centavos; `committed` = pagas + pendentes com vencimento no mês (P2). */
export type BudgetItemDTO = {
  categoryId: string;
  name: string;
  icon: string;
  color: string;
  limit: number;
  paid: number;
  pending: number;
  committed: number;
  percent: number;
  status: BudgetStatus;
  suggested: number | null;
};

export type BudgetCategoryDTO = { categoryId: string; name: string; icon: string; color: string; suggested: number | null };

export type BudgetMonthDTO = {
  month: string;
  items: BudgetItemDTO[];
  categoriesWithoutBudget: BudgetCategoryDTO[];
  totals: { limit: number; committed: number };
  income: { paid: number; pending: number };
  /** Receitas do mês (pagas + previstas) − orçamento total (P5). */
  plannedLeftover: number;
};

export type ForecastMonthDTO = { month: string; income: number; expense: number };

/** Resumo do orçamento para o painel (P10); `null` sem nenhum limite. */
export type BudgetSummaryDTO = { limit: number; committed: number; nearCount: number; overCount: number };

// ---------- Metas (spec P6–P8) ----------

const goalFields = { name: nameSchema, targetAmount: centsSchema, targetDate: dateOnlySchema };

/** "Prazo no passado" depende de hoje: validado no serviço (422). */
export const createGoalSchema = z.object(goalFields);
export const updateGoalSchema = z.object(goalFields).partial().refine(nonEmpty, NON_EMPTY_MESSAGE);

/** Depósito (positivo) ou retirada (negativo) na meta; não mexe em saldo de conta (P6). */
export const contributionSchema = z.object({
  amount: z
    .number('Informe um número')
    .int('Valor deve ser em centavos (inteiro)')
    .min(-MAX_CENTS, 'Valor acima do limite')
    .max(MAX_CENTS, 'Valor acima do limite')
    .refine((v) => v !== 0, 'Informe um valor diferente de zero'),
  date: dateOnlySchema,
  note: z.string().trim().max(80, 'Máximo de 80 caracteres').optional(),
});

export type CreateGoalInput = z.output<typeof createGoalSchema>;
export type UpdateGoalInput = z.output<typeof updateGoalSchema>;
export type ContributionInput = z.output<typeof contributionSchema>;
export type GoalStatus = 'reached' | 'overdue' | 'on_track' | 'late';

export type GoalDTO = {
  id: string;
  name: string;
  targetAmount: number;
  targetDate: string;
  saved: number;
  createdAt: string;
  fraction: number;
  status: GoalStatus;
  monthlyNeeded: number;
  monthsLeft: number;
};

export type GoalContributionDTO = { id: string; amount: number; date: string; note: string | null };
export type GoalDetailDTO = GoalDTO & { contributions: GoalContributionDTO[] };
