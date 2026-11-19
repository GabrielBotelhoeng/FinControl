import {
  addMonthsToYm, budgetStatus, endOfMonth, maxDate, monthOf, suggestedLimit, todayInSaoPaulo,
  type BudgetMonthDTO, type BudgetSummaryDTO, type ForecastMonthDTO, type YearMonth,
} from '@fincontrol/shared';
import { NotFoundError, UnprocessableError } from '../../http/errors';
import type { CategoriesRepository } from '../categories/categories.repository';
import type { RecurrencesService } from '../recurrences/recurrences.service';
import type { BudgetsRepository } from './budgets.repository';

const SUGGESTION_WINDOW = 3;
/**
 * As recorrências são materializadas até hoje + 366 dias. O mês atual + 11 sempre termina antes disso (até ~364 dias);
 * com + 12 o fim do mês ficaria de fora e os totais sairiam incompletos.
 */
const MAX_MONTHS_AHEAD = 11;

export type BudgetsServiceDeps = {
  repo: BudgetsRepository;
  categoriesRepo: CategoriesRepository;
  recurrences: RecurrencesService;
  clock: () => Date;
};

export function createBudgetsService(deps: BudgetsServiceDeps) {
  const currentMonth = () => monthOf(todayInSaoPaulo(deps.clock()));

  async function getOwnedExpenseCategory(userId: string, categoryId: string) {
    const category = await deps.categoriesRepo.findById(userId, categoryId);
    if (!category) throw new NotFoundError('Categoria');
    if (category.type !== 'expense') throw new UnprocessableError('Limite só vale para categorias de despesa.');
    // Sub-projeto 15 (U6): o gasto das subcategorias já entra no limite da categoria.
    if (category.parentId) throw new UnprocessableError('O limite vale para a categoria principal; o gasto das subcategorias entra nele.');
    return category;
  }

  return {
    async getMonth(userId: string, month?: YearMonth): Promise<BudgetMonthDTO> {
      const m = month ?? currentMonth();
      if (m > addMonthsToYm(currentMonth(), MAX_MONTHS_AHEAD)) {
        throw new UnprocessableError('O planejamento vai até 11 meses à frente.');
      }
      // Recorrências viram lançamentos até o fim do mês pedido (e nunca antes do fim do mês atual).
      await deps.recurrences.materialize(userId, maxDate(endOfMonth(m), endOfMonth(currentMonth())));
      const window = Array.from({ length: SUGGESTION_WINDOW }, (_, i) => addMonthsToYm(m, -(i + 1)));
      const [categories, budgets, spend, history, totals] = await Promise.all([
        deps.categoriesRepo.list(userId, 'expense'),
        deps.repo.list(userId),
        deps.repo.expenseByCategory(userId, m),
        deps.repo.paidExpenseByCategory(userId, window),
        deps.repo.totalsByStatus(userId, m),
      ]);
      const limits = new Map(budgets.map((b) => [b.categoryId, b.limit]));
      const items: BudgetMonthDTO['items'] = [];
      const categoriesWithoutBudget: BudgetMonthDTO['categoriesWithoutBudget'] = [];
      // U6: só as categorias principais têm limite.
      for (const c of categories.filter((x) => x.parentId === null)) {
        const suggested = suggestedLimit(history.get(c.id) ?? []);
        const limit = limits.get(c.id);
        const base = { categoryId: c.id, name: c.name, icon: c.icon, color: c.color, suggested };
        if (limit === undefined) {
          categoriesWithoutBudget.push(base);
          continue;
        }
        const { paid, pending } = spend.get(c.id) ?? { paid: 0, pending: 0 };
        const committed = paid + pending;
        items.push({ ...base, limit, paid, pending, committed, ...budgetStatus(committed, limit) });
      }
      const limit = items.reduce((s, i) => s + i.limit, 0);
      return {
        month: m,
        items,
        categoriesWithoutBudget,
        totals: { limit, committed: items.reduce((s, i) => s + i.committed, 0) },
        income: totals.income,
        plannedLeftover: totals.income.paid + totals.income.pending - limit,
      };
    },

    /** Devolve o id gravado no banco, e não o texto da URL (spec do sub-projeto 4, R13 b). */
    async set(userId: string, categoryId: string, limit: number): Promise<string> {
      const category = await getOwnedExpenseCategory(userId, categoryId);
      await deps.repo.upsert(userId, category.id, limit);
      return category.id;
    },

    async remove(userId: string, categoryId: string): Promise<void> {
      await getOwnedExpenseCategory(userId, categoryId);
      await deps.repo.delete(userId, categoryId);
    },

    /** Mês atual + os seguintes: receitas e despesas pagas e pendentes por vencimento (P5). */
    async forecast(userId: string, months: number): Promise<ForecastMonthDTO[]> {
      const list = Array.from({ length: months }, (_, i) => addMonthsToYm(currentMonth(), i));
      await deps.recurrences.materialize(userId, endOfMonth(list[list.length - 1]!));
      const totals = await Promise.all(list.map((m) => deps.repo.totalsByStatus(userId, m)));
      return list.map((month, i) => ({
        month,
        income: totals[i]!.income.paid + totals[i]!.income.pending,
        expense: totals[i]!.expense.paid + totals[i]!.expense.pending,
      }));
    },

    /** Resumo para o painel (P10), sem materializar de novo (o painel já materializou); `null` sem nenhum limite. */
    async summaryFor(userId: string, month: YearMonth): Promise<BudgetSummaryDTO | null> {
      const [budgets, spend] = await Promise.all([deps.repo.list(userId), deps.repo.expenseByCategory(userId, month)]);
      if (budgets.length === 0) return null;
      let committed = 0;
      let nearCount = 0;
      let overCount = 0;
      for (const b of budgets) {
        const s = spend.get(b.categoryId) ?? { paid: 0, pending: 0 };
        const c = s.paid + s.pending;
        committed += c;
        const { status } = budgetStatus(c, b.limit);
        if (status === 'near') nearCount += 1;
        if (status === 'over') overCount += 1;
      }
      return { limit: budgets.reduce((s, b) => s + b.limit, 0), committed, nearCount, overCount };
    },
  };
}

export type BudgetsService = ReturnType<typeof createBudgetsService>;
