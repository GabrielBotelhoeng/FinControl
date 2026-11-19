import {
  accountTypeSchema, addMonthsToYm, assetValueAt, endOfMonth, maxDate, monthOf, startOfMonth, todayInSaoPaulo,
  type AccountType, type CategorySpendDTO, type DashboardSummaryDTO, type EvolutionPointDTO, type UpcomingItemDTO, type YearMonth,
} from '@fincontrol/shared';
import { computeForecast, percentChange } from '../../domain/balance';
import { debtCommitment, reserveCoverage, savingsRate } from '../../domain/health';
import type { AccountsRepository } from '../accounts/accounts.repository';
import type { AssetsRepository } from '../assets/assets.repository';
import type { BudgetsService } from '../budgets/budgets.service';
import type { CardsService } from '../cards/cards.service';
import type { LoansRepository } from '../loans/loans.repository';
import type { RecurrencesService } from '../recurrences/recurrences.service';
import { debtsAt, type DebtsReader } from '../reports/debts';
import { toTransactionDTO } from '../transactions/transactions.mapper';
import type { TransactionsRepository } from '../transactions/transactions.repository';
import { cardDebt } from './dashboard.cards';
import type { DashboardRepository } from './dashboard.repository';

const UPCOMING_LIMIT = 10;
/** Contas que entram na reserva: liquidez imediata. Investimentos ficam de fora (liquidez não garantida). */
const LIQUID_TYPES: AccountType[] = ['checking', 'savings', 'wallet'];
const RESERVE_WINDOW_MONTHS = 3;
/** Patrimônio líquido (sub-projeto 11, B1): todas as contas menos os cartões, que entram só como dívida. */
const NET_WORTH_TYPES: AccountType[] = accountTypeSchema.options.filter((type) => type !== 'credit_card');

export type DashboardServiceDeps = {
  repo: DashboardRepository;
  transactions: TransactionsRepository;
  recurrences: RecurrencesService;
  accountsRepo: AccountsRepository;
  cards: CardsService;
  loansRepo: Pick<LoansRepository, 'installmentsDueIn'>;
  budgets: Pick<BudgetsService, 'summaryFor'>;
  debts: DebtsReader;
  assets: Pick<AssetsRepository, 'list'>;
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
      // A dívida de cartão (dashboard.cards.ts) entra no mesmo Promise.all: roda em paralelo e, se falhar,
      // a rejeição é tratada junto com as demais (nunca fica uma promise solta sem handler).
      const [now, before, totalBalance, pending, pendingCount, overdueCount, upcomingTx, liquidBalance, recent, debt, loanPayments, budget, debtSources, netWorthBalance, assets] = await Promise.all([
        repo.paidTotalsByType(userId, startOfMonth(m), monthEnd),
        repo.paidTotalsByType(userId, startOfMonth(previous), endOfMonth(previous)),
        repo.balanceAt(userId),
        repo.pendingTotalsUntil(userId, currentEnd),
        repo.countPendingUntil(userId, monthEnd),
        repo.countOverdue(userId, t),
        deps.transactions.listPendingUntil(userId, monthEnd, UPCOMING_LIMIT),
        repo.balanceAt(userId, undefined, LIQUID_TYPES),
        Promise.all(reserveWindow.map((rm) => repo.paidTotalsByType(userId, startOfMonth(rm), endOfMonth(rm)))),
        cardDebt(
          { accountsRepo: deps.accountsRepo, cards: deps.cards, installmentTotalsByAccount: repo.installmentTotalsByAccount },
          userId,
          current,
        ),
        deps.loansRepo.installmentsDueIn(userId, current),
        deps.budgets.summaryFor(userId, m),
        deps.debts.load(userId),
        repo.balanceAt(userId, t, NET_WORTH_TYPES),
        deps.assets.list(userId),
      ]);
      // Comprometimento (C13): dívida do cartão + parcelas de empréstimo com vencimento no mês corrente.
      const debtPayments = debt.debtPayments + loanPayments;
      const reserve = reserveCoverage(liquidBalance, recent.map((r) => r.expense));
      const debts = debtsAt(debtSources, t);

      // "A pagar" (decisão R16): lançamentos pendentes e faturas fechadas/vencidas mesclados por vencimento,
      // respeitando o mesmo limite de sempre. As faturas entram independente do mês consultado (`m`).
      const upcoming: UpcomingItemDTO[] = [
        ...upcomingTx.map((r) => ({ ...toTransactionDTO(r, t), kind: 'transaction' as const })),
        ...debt.items,
      ]
        .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
        .slice(0, UPCOMING_LIMIT);

      return {
        month: m,
        totalBalance,
        forecastEndOfMonth: computeForecast(totalBalance, pending.income, pending.expense),
        income: { current: now.income, previous: before.income, changePercent: percentChange(now.income, before.income) },
        expense: { current: now.expense, previous: before.expense, changePercent: percentChange(now.expense, before.expense) },
        pendingCount: pendingCount + debt.pendingCount,
        overdueCount: overdueCount + debt.overdueCount,
        upcoming,
        budget,
        debts,
        // B9: o mesmo número de hoje da página do patrimônio.
        netWorth: netWorthBalance + assets.reduce((sum, a) => sum + assetValueAt(a.valuations, t), 0) - debts.total,
        health: {
          savingsRate: savingsRate(now.income, now.expense),
          reserveMonths: reserve.months,
          liquidBalance,
          averageMonthlyExpense: reserve.averageExpense,
          debtCommitment: debtCommitment(debtPayments, recent.map((r) => r.income)),
          debtPayments,
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
