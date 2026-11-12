import type { AccountType, CategorySpendDTO, DateOnly, TransactionType } from '@fincontrol/shared';
import type { Prisma } from '../../generated/prisma/client';
import { fromDateOnly } from '../../infra/date-mapping';
import type { Db } from '../../infra/prisma';

type Totals = { income: number; expense: number };
type TypeGroup = { type: TransactionType; _sum: { amount: bigint | null } };

function totals(groups: TypeGroup[]): Totals {
  const result = { income: 0, expense: 0 };
  for (const g of groups) {
    if (g.type === 'income') result.income += Number(g._sum.amount ?? 0n);
    if (g.type === 'expense') result.expense += Number(g._sum.amount ?? 0n);
  }
  return result;
}

function paidWhere(userId: string, from?: DateOnly, to?: DateOnly): Prisma.TransactionWhereInput {
  const range = { ...(from ? { gte: fromDateOnly(from) } : {}), ...(to ? { lte: fromDateOnly(to) } : {}) };
  return { userId, status: 'paid', ...(from || to ? { paidDate: range } : {}) };
}

const activeAccount: Prisma.TransactionWhereInput = { account: { archivedAt: null } };

export function createDashboardRepository(db: Db) {
  return {
    /** Receitas e despesas pagas no período (pela data de pagamento). Transferências ficam de fora. */
    async paidTotalsByType(userId: string, from: DateOnly, to: DateOnly): Promise<Totals> {
      const groups = await db.transaction.groupBy({ by: ['type'], where: paidWhere(userId, from, to), _sum: { amount: true } });
      return totals(groups);
    },

    async pendingTotalsUntil(userId: string, until: DateOnly): Promise<Totals> {
      const groups = await db.transaction.groupBy({
        by: ['type'],
        where: { userId, status: 'pending', dueDate: { lte: fromDateOnly(until) }, ...activeAccount },
        _sum: { amount: true },
      });
      return totals(groups);
    },

    countPendingUntil(userId: string, until: DateOnly): Promise<number> {
      return db.transaction.count({ where: { userId, status: 'pending', dueDate: { lte: fromDateOnly(until) }, ...activeAccount } });
    },

    countOverdue(userId: string, today: DateOnly): Promise<number> {
      return db.transaction.count({ where: { userId, status: 'pending', dueDate: { lt: fromDateOnly(today) }, ...activeAccount } });
    },

    /** Saldo somado das contas não arquivadas (opcionalmente só de alguns tipos), com os pagamentos até `until` (ou todos). */
    async balanceAt(userId: string, until?: DateOnly, types?: AccountType[]): Promise<number> {
      const paid = paidWhere(userId, undefined, until);
      const account = { archivedAt: null, ...(types ? { type: { in: types } } : {}) };
      const [initial, own, incoming] = await Promise.all([
        db.account.aggregate({ where: { userId, ...account }, _sum: { initialBalance: true } }),
        db.transaction.groupBy({ by: ['type'], where: { ...paid, account }, _sum: { amount: true } }),
        db.transaction.aggregate({ where: { ...paid, type: 'transfer', destinationAccount: account }, _sum: { amount: true } }),
      ]);
      let balance = Number(initial._sum.initialBalance ?? 0n);
      for (const g of own) {
        const value = Number(g._sum.amount ?? 0n);
        balance += g.type === 'income' ? value : -value;
      }
      return balance + Number(incoming._sum.amount ?? 0n);
    },

    async expenseByCategory(userId: string, from: DateOnly, to: DateOnly): Promise<CategorySpendDTO[]> {
      const groups = await db.transaction.groupBy({
        by: ['categoryId'],
        where: { ...paidWhere(userId, from, to), type: 'expense' },
        _sum: { amount: true },
      });
      const ids = groups.map((g) => g.categoryId).filter((id): id is string => id !== null);
      const categories = await db.category.findMany({ where: { userId, id: { in: ids } } });
      const byId = new Map(categories.map((c) => [c.id, c]));
      return groups
        .flatMap((g) => {
          const c = g.categoryId ? byId.get(g.categoryId) : undefined;
          return c ? [{ categoryId: c.id, name: c.name, icon: c.icon, color: c.color, total: Number(g._sum.amount ?? 0n) }] : [];
        })
        .sort((x, y) => y.total - x.total);
    },
  };
}

export type DashboardRepository = ReturnType<typeof createDashboardRepository>;
