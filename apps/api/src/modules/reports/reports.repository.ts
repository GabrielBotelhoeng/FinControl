import {
  monthOf, type AccountType, type DateOnly, type ReportBalanceDTO, type ReportExpenseDTO, type TransactionNature, type TransactionStatus, type TransactionType,
} from '@fincontrol/shared';
import type { Prisma } from '../../generated/prisma/client';
import { fromDateOnly, toDateOnly } from '../../infra/date-mapping';
import type { Db } from '../../infra/prisma';

export type CategoryRef = { id: string; name: string; icon: string; color: string };
export type MonthTotals = Map<string, { income: number; expense: number }>;

/** Pagas no período pela data de pagamento (R2); transferências ficam de fora de quem chama. */
const paidIn = (userId: string, from: DateOnly, to: DateOnly): Prisma.TransactionWhereInput => ({
  userId, status: 'paid', paidDate: { gte: fromDateOnly(from), lte: fromDateOnly(to) },
});

export type CsvRow = {
  date: DateOnly;
  description: string;
  type: TransactionType;
  status: TransactionStatus;
  nature: TransactionNature | null;
  category: string | null;
  account: string;
  destination: string | null;
  amount: number;
};

export function createReportsRepository(db: Db) {
  /**
   * Saldo no fim de cada dia de `dates` (na mesma ordem) das contas não arquivadas, sem cartões (R7): uma leitura só,
   * e cada data sai em memória (a série do patrimônio, B8 do sub-projeto 11, tem 12 datas).
   */
  async function balancesAt(userId: string, dates: DateOnly[]): Promise<ReportBalanceDTO[][]> {
    const accounts = await db.account.findMany({
      where: { userId, archivedAt: null, type: { not: 'credit_card' } },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
      select: { id: true, name: true, type: true, initialBalance: true },
    });
    if (accounts.length === 0 || dates.length === 0) return dates.map(() => []);
    const ids = accounts.map((a) => a.id);
    const last = dates.reduce((a, b) => (a > b ? a : b));
    const until = { userId, status: 'paid' as const, paidDate: { lte: fromDateOnly(last) } };
    const [own, incoming] = await Promise.all([
      db.transaction.groupBy({ by: ['accountId', 'type', 'paidDate'], where: { ...until, accountId: { in: ids } }, _sum: { amount: true } }),
      db.transaction.groupBy({ by: ['destinationAccountId', 'paidDate'], where: { ...until, type: 'transfer', destinationAccountId: { in: ids } }, _sum: { amount: true } }),
    ]);
    const moves = [
      ...own.flatMap((g) => (g.paidDate ? [{ accountId: g.accountId, date: toDateOnly(g.paidDate), delta: (g.type === 'income' ? 1 : -1) * Number(g._sum.amount ?? 0n) }] : [])),
      ...incoming.flatMap((g) => (g.destinationAccountId && g.paidDate ? [{ accountId: g.destinationAccountId, date: toDateOnly(g.paidDate), delta: Number(g._sum.amount ?? 0n) }] : [])),
    ];
    return dates.map((at) => {
      const balance = new Map(accounts.map((a) => [a.id, Number(a.initialBalance)]));
      for (const m of moves) if (m.date <= at) balance.set(m.accountId, balance.get(m.accountId)! + m.delta);
      return accounts.map((a) => ({ accountId: a.id, name: a.name, type: a.type as AccountType, balance: balance.get(a.id)! }));
    });
  }

  return {
    /** Total por categoria das receitas ou despesas pagas no período. */
    async totalsByCategory(userId: string, type: 'income' | 'expense', from: DateOnly, to: DateOnly): Promise<Map<string, number>> {
      const groups = await db.transaction.groupBy({ by: ['categoryId'], where: { ...paidIn(userId, from, to), type }, _sum: { amount: true } });
      return new Map(groups.filter((g) => g.categoryId).map((g) => [g.categoryId!, Number(g._sum.amount ?? 0n)]));
    },

    async categories(userId: string, ids: string[]): Promise<Map<string, CategoryRef>> {
      if (ids.length === 0) return new Map();
      const rows = await db.category.findMany({ where: { userId, id: { in: ids } }, select: { id: true, name: true, icon: true, color: true } });
      return new Map(rows.map((c) => [c.id, c]));
    },

    /** Receitas e despesas pagas por mês (pela data de pagamento), de `from` a `to`. */
    async monthTotals(userId: string, from: DateOnly, to: DateOnly): Promise<MonthTotals> {
      const groups = await db.transaction.groupBy({
        by: ['paidDate', 'type'],
        where: { ...paidIn(userId, from, to), type: { in: ['income', 'expense'] } },
        _sum: { amount: true },
      });
      const out: MonthTotals = new Map();
      for (const g of groups) {
        if (!g.paidDate) continue;
        const m = monthOf(toDateOnly(g.paidDate));
        const slot = out.get(m) ?? { income: 0, expense: 0 };
        if (g.type === 'income') slot.income += Number(g._sum.amount ?? 0n);
        else slot.expense += Number(g._sum.amount ?? 0n);
        out.set(m, slot);
      }
      return out;
    },

    async topExpenses(userId: string, from: DateOnly, to: DateOnly, limit: number): Promise<ReportExpenseDTO[]> {
      const rows = await db.transaction.findMany({
        where: { ...paidIn(userId, from, to), type: 'expense' },
        orderBy: [{ amount: 'desc' }, { paidDate: 'desc' }, { id: 'asc' }],
        take: limit,
        select: { id: true, paidDate: true, description: true, amount: true, category: { select: { name: true } }, account: { select: { name: true } } },
      });
      return rows.map((r) => ({
        id: r.id, date: toDateOnly(r.paidDate!), description: r.description,
        category: r.category?.name ?? 'Sem categoria', account: r.account.name, amount: Number(r.amount),
      }));
    },

    /** Saldo no fim do dia `at` das contas não arquivadas, sem cartões (R7). */
    async balances(userId: string, at: DateOnly): Promise<ReportBalanceDTO[]> {
      return (await balancesAt(userId, [at]))[0]!;
    },

    balancesAt,

    /**
     * Lançamentos do período para o CSV (R9), por data de competência: a de pagamento, ou o vencimento quando
     * pendente. Pagas e pendentes; transferências inclusive.
     */
    async csvRows(userId: string, from: DateOnly, to: DateOnly): Promise<CsvRow[]> {
      const range = { gte: fromDateOnly(from), lte: fromDateOnly(to) };
      const rows = await db.transaction.findMany({
        where: { userId, OR: [{ status: 'paid', paidDate: range }, { status: 'pending', dueDate: range }] },
        select: {
          type: true, status: true, nature: true, amount: true, description: true, dueDate: true, paidDate: true,
          category: { select: { name: true } }, account: { select: { name: true } }, destinationAccount: { select: { name: true } },
        },
      });
      return rows
        .map((r) => ({
          date: toDateOnly(r.status === 'paid' && r.paidDate ? r.paidDate : r.dueDate),
          description: r.description,
          type: r.type,
          status: r.status,
          nature: r.nature,
          category: r.category?.name ?? null,
          account: r.account.name,
          destination: r.destinationAccount?.name ?? null,
          amount: Number(r.amount),
        }))
        .sort((a, b) => a.date.localeCompare(b.date) || a.description.localeCompare(b.description, 'pt-BR'));
    },
  };
}

export type ReportsRepository = ReturnType<typeof createReportsRepository>;
