import { endOfMonth, startOfMonth, type YearMonth } from '@fincontrol/shared';
import { fromDateOnly } from '../../infra/date-mapping';
import type { Db } from '../../infra/prisma';
import { foldIntoParents, subcategoryParents } from '../categories/rollup';

export type BudgetRow = { categoryId: string; limit: number };
/**
 * Despesas do mês por categoria, separadas em pagas e pendentes (P2: pelo vencimento, que no cartão é a data da compra).
 * As subcategorias somam na categoria principal (sub-projeto 15, U6).
 */
export type CategorySpend = Map<string, { paid: number; pending: number }>;

const monthRange = (m: YearMonth) => ({ gte: fromDateOnly(startOfMonth(m)), lte: fromDateOnly(endOfMonth(m)) });

export function createBudgetsRepository(db: Db) {
  return {
    async list(userId: string): Promise<BudgetRow[]> {
      const rows = await db.budget.findMany({ where: { userId }, select: { categoryId: true, limitAmount: true } });
      return rows.map((r) => ({ categoryId: r.categoryId, limit: Number(r.limitAmount) }));
    },

    async upsert(userId: string, categoryId: string, limit: number): Promise<void> {
      await db.budget.upsert({
        where: { userId_categoryId: { userId, categoryId } },
        create: { userId, categoryId, limitAmount: BigInt(limit) },
        update: { limitAmount: BigInt(limit) },
      });
    },

    async delete(userId: string, categoryId: string): Promise<void> {
      await db.budget.deleteMany({ where: { userId, categoryId } });
    },

    async expenseByCategory(userId: string, month: YearMonth): Promise<CategorySpend> {
      const groups = await db.transaction.groupBy({
        by: ['categoryId', 'status'],
        where: { userId, type: 'expense', categoryId: { not: null }, dueDate: monthRange(month) },
        _sum: { amount: true },
      });
      const out: CategorySpend = new Map();
      for (const g of groups) {
        const entry = out.get(g.categoryId!) ?? { paid: 0, pending: 0 };
        entry[g.status] += Number(g._sum.amount ?? 0n);
        out.set(g.categoryId!, entry);
      }
      return foldIntoParents(out, await subcategoryParents(db, userId), (a, b) => ({ paid: a.paid + b.paid, pending: a.pending + b.pending }));
    },

    /** Gasto pago por categoria em cada mês pedido (base da sugestão, P4), com as subcategorias na principal (U6). */
    async paidExpenseByCategory(userId: string, months: YearMonth[]): Promise<Map<string, number[]>> {
      const perMonth = await Promise.all(
        months.map((m) =>
          db.transaction.groupBy({
            by: ['categoryId'],
            where: { userId, type: 'expense', status: 'paid', categoryId: { not: null }, dueDate: monthRange(m) },
            _sum: { amount: true },
          }),
        ),
      );
      const out = new Map<string, number[]>();
      perMonth.forEach((groups, i) => {
        for (const g of groups) {
          const values = out.get(g.categoryId!) ?? months.map(() => 0);
          values[i] = Number(g._sum.amount ?? 0n);
          out.set(g.categoryId!, values);
        }
      });
      return foldIntoParents(out, await subcategoryParents(db, userId), (a, b) => a.map((v, i) => v + b[i]!));
    },

    /** Receitas e despesas do mês (pagas e pendentes) por vencimento. Transferências ficam de fora. */
    async totalsByStatus(userId: string, month: YearMonth) {
      const groups = await db.transaction.groupBy({
        by: ['type', 'status'],
        where: { userId, type: { in: ['income', 'expense'] }, dueDate: monthRange(month) },
        _sum: { amount: true },
      });
      const out = { income: { paid: 0, pending: 0 }, expense: { paid: 0, pending: 0 } };
      for (const g of groups) out[g.type as 'income' | 'expense'][g.status] += Number(g._sum.amount ?? 0n);
      return out;
    },
  };
}

export type BudgetsRepository = ReturnType<typeof createBudgetsRepository>;
