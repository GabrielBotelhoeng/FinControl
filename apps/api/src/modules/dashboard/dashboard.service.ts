import {
  addMonthsToYm, endOfMonth, maxDate, monthOf, startOfMonth, todayInSaoPaulo,
  type AccountType, type CategorySpendDTO, type DashboardSummaryDTO, type EvolutionPointDTO, type YearMonth,
} from '@fincontrol/shared';
import { computeForecast, percentChange } from '../../domain/balance';
import { reserveCoverage, savingsRate } from '../../domain/health';
import type { RecurrencesService } from '../recurrences/recurrences.service';
import { toTransactionDTO } from '../transactions/transactions.mapper';
import type { TransactionsRepository } from '../transactions/transactions.repository';
import type { DashboardRepository } from './dashboard.repository';

const UPCOMING_LIMIT = 10;
/** Contas que entram na reserva: liquidez imediata. Investimentos ficam de fora (liquidez não garantida). */
const LIQUID_TYPES: AccountType[] = ['checking', 'savings', 'wallet'];
const RESERVE_WINDOW_MONTHS = 3;

export type DashboardServiceDeps = {
  repo: DashboardRepository;
  transactions: TransactionsRepository;
  recurrences: RecurrencesService;
  clock: () => Date;
};

export function createDashboardService(deps: DashboardServiceDeps) {
  const { repo } = deps;
  const today = () => todayInSaoPaulo(deps.clock());

  return {
    async summary(userId: string, month?: YearMonth): Promise<DashboardSummaryDTO> {
      const t = today();
      const current = monthOf(t);
      const m = month ?? current;
      const monthEnd = endOfMonth(m);
      const currentEnd = endOfMonth(current);
      const previous = addMonthsToYm(m, -1);
      await deps.recurrences.materialize(userId, maxDate(monthEnd, currentEnd));

      // A reserva é medida "agora": saldo líquido atual ÷ gasto médio dos meses completos antes do mês corrente.
      const reserveWindow = Array.from({ length: RESERVE_WINDOW_MONTHS }, (_, i) => addMonthsToYm(current, -(i + 1)));
      const [now, before, totalBalance, pending, pendingCount, overdueCount, upcoming, liquidBalance, recent] = await Promise.all([
        repo.paidTotalsByType(userId, startOfMonth(m), monthEnd),
        repo.paidTotalsByType(userId, startOfMonth(previous), endOfMonth(previous)),
        repo.balanceAt(userId),
        repo.pendingTotalsUntil(userId, currentEnd),
        repo.countPendingUntil(userId, monthEnd),
        repo.countOverdue(userId, t),
        deps.transactions.listPendingUntil(userId, monthEnd, UPCOMING_LIMIT),
        repo.balanceAt(userId, undefined, LIQUID_TYPES),
        Promise.all(reserveWindow.map((rm) => repo.paidTotalsByType(userId, startOfMonth(rm), endOfMonth(rm)))),
      ]);
      const reserve = reserveCoverage(liquidBalance, recent.map((r) => r.expense));

      return {
        month: m,
        totalBalance,
        forecastEndOfMonth: computeForecast(totalBalance, pending.income, pending.expense),
        income: { current: now.income, previous: before.income, changePercent: percentChange(now.income, before.income) },
        expense: { current: now.expense, previous: before.expense, changePercent: percentChange(now.expense, before.expense) },
        pendingCount,
        overdueCount,
        upcoming: upcoming.map((r) => toTransactionDTO(r, t)),
        health: {
          savingsRate: savingsRate(now.income, now.expense),
          reserveMonths: reserve.months,
          liquidBalance,
          averageMonthlyExpense: reserve.averageExpense,
          // Comprometimento de renda (parcelas de cartão + faturas vencidas) entra na Tarefa 8.
          debtCommitment: null,
          debtPayments: 0,
        },
      };
    },

    async evolution(userId: string, months: number): Promise<EvolutionPointDTO[]> {
      const current = monthOf(today());
      const list = Array.from({ length: months }, (_, i) => addMonthsToYm(current, i - months + 1));
      return Promise.all(
        list.map(async (m) => {
          const [sums, endBalance] = await Promise.all([
            repo.paidTotalsByType(userId, startOfMonth(m), endOfMonth(m)),
            repo.balanceAt(userId, endOfMonth(m)),
          ]);
          return { month: m, income: sums.income, expense: sums.expense, endBalance };
        }),
      );
    },

    byCategory(userId: string, month?: YearMonth): Promise<CategorySpendDTO[]> {
      const m = month ?? monthOf(today());
      return repo.expenseByCategory(userId, startOfMonth(m), endOfMonth(m));
    },
  };
}

export type DashboardService = ReturnType<typeof createDashboardService>;
