import {
  compareTags, monthOf, todayInSaoPaulo, type AccountType, type DateOnly, type ReportBalanceDTO, type ReportExpenseDTO, type TransactionNature, type TransactionStatus, type TransactionType,
} from '@fincontrol/shared';
import type { Prisma } from '../../generated/prisma/client';
import { fromDateOnly, toDateOnly } from '../../infra/date-mapping';
import type { Db, DbClient } from '../../infra/prisma';

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
  /** Sub-projeto 14 (H6, H7): em ordem alfabética. */
  tags: string[];
};

export function createReportsRepository(db: Db) {
  /**
   * Saldo no fim de cada dia de `dates` (na ordem recebida) das contas sem cartões (R7). Sem `today`, só as não
   * arquivadas. Com `today` (a série do patrimônio, B1 do sub-projeto 11), a conta arquivada ainda conta nas datas
   * antes do dia em que foi arquivada, para o passado não mudar quando ela é arquivada; hoje, como no saldo total, não.
   * O saldo até a primeira data sai agrupado por conta; só o trecho até a última vem dia a dia. As leituras ficam numa
   * transação com leitura repetível (revisão do CodeRabbit): um pagamento que muda de data entre elas não conta duas vezes.
   */
  async function balancesAt(userId: string, dates: DateOnly[], opts: { today?: DateOnly } = {}): Promise<ReportBalanceDTO[][]> {
    if (dates.length === 0) return [];
    return db.$transaction((tx) => readBalances(tx, userId, dates, opts), { isolationLevel: 'RepeatableRead' });
  }

  async function readBalances(db: DbClient, userId: string, dates: DateOnly[], opts: { today?: DateOnly }): Promise<ReportBalanceDTO[][]> {
    const accounts = await db.account.findMany({
      where: { userId, type: { not: 'credit_card' }, ...(opts.today ? {} : { archivedAt: null }) },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
      select: { id: true, name: true, type: true, initialBalance: true, archivedAt: true },
    });
    if (accounts.length === 0) return dates.map(() => []);
    const ids = accounts.map((a) => a.id);
    const sorted = [...dates].sort();
    const first = sorted[0]!;
    const last = sorted[sorted.length - 1]!;
    const own = { userId, status: 'paid' as const, accountId: { in: ids } };
    const incoming = { userId, status: 'paid' as const, type: 'transfer' as const, destinationAccountId: { in: ids } };
    const upToFirst = { lte: fromDateOnly(first) };
    const afterFirst = { gt: fromDateOnly(first), lte: fromDateOnly(last) };
    const [ownBase, incomingBase, ownDaily, incomingDaily] = await Promise.all([
      db.transaction.groupBy({ by: ['accountId', 'type'], where: { ...own, paidDate: upToFirst }, _sum: { amount: true } }),
      db.transaction.groupBy({ by: ['destinationAccountId'], where: { ...incoming, paidDate: upToFirst }, _sum: { amount: true } }),
      first === last ? [] : db.transaction.groupBy({ by: ['accountId', 'type', 'paidDate'], where: { ...own, paidDate: afterFirst }, _sum: { amount: true } }),
      first === last ? [] : db.transaction.groupBy({ by: ['destinationAccountId', 'paidDate'], where: { ...incoming, paidDate: afterFirst }, _sum: { amount: true } }),
    ]);
    const sign = (type: TransactionType) => (type === 'income' ? 1 : -1);
    const base = new Map(accounts.map((a) => [a.id, Number(a.initialBalance)]));
    for (const g of ownBase) base.set(g.accountId, base.get(g.accountId)! + sign(g.type) * Number(g._sum.amount ?? 0n));
    for (const g of incomingBase) {
      if (g.destinationAccountId) base.set(g.destinationAccountId, base.get(g.destinationAccountId)! + Number(g._sum.amount ?? 0n));
    }
    const moves = [
      ...ownDaily.flatMap((g) => (g.paidDate ? [{ accountId: g.accountId, date: toDateOnly(g.paidDate), delta: sign(g.type) * Number(g._sum.amount ?? 0n) }] : [])),
      ...incomingDaily.flatMap((g) =>
        g.destinationAccountId && g.paidDate ? [{ accountId: g.destinationAccountId, date: toDateOnly(g.paidDate), delta: Number(g._sum.amount ?? 0n) }] : [],
      ),
    ];
    const counts = (archivedAt: Date | null, at: DateOnly) =>
      archivedAt === null || (opts.today !== undefined && at < opts.today && todayInSaoPaulo(archivedAt) > at);
    return dates.map((at) => {
      const balance = new Map(base);
      for (const m of moves) if (m.date <= at) balance.set(m.accountId, balance.get(m.accountId)! + m.delta);
      return accounts
        .filter((a) => counts(a.archivedAt, at))
        .map((a) => ({ accountId: a.id, name: a.name, type: a.type as AccountType, balance: balance.get(a.id)! }));
    });
  }

  return {
    /** Total por categoria das receitas ou despesas pagas no período. */
    async totalsByCategory(userId: string, type: 'income' | 'expense', from: DateOnly, to: DateOnly): Promise<Map<string, number>> {
      const groups = await db.transaction.groupBy({ by: ['categoryId'], where: { ...paidIn(userId, from, to), type }, _sum: { amount: true } });
      return new Map(groups.filter((g) => g.categoryId).map((g) => [g.categoryId!, Number(g._sum.amount ?? 0n)]));
    },

    /** Total e quantidade das despesas pagas no período de cada tag (sub-projeto 14, H1); o lançamento conta em todas as suas tags (H2). */
    async totalsByTag(userId: string, from: DateOnly, to: DateOnly): Promise<Map<string, { total: number; count: number }>> {
      const rows = await db.$queryRaw<{ name: string; total: bigint; count: number }[]>`
        SELECT tag AS "name", SUM("amount")::bigint AS "total", COUNT(*)::int AS "count"
        FROM "transactions", unnest("tags") AS tag
        WHERE "user_id" = ${userId}::uuid AND "status" = 'paid' AND "type" = 'expense'
          AND "paid_date" BETWEEN ${from}::date AND ${to}::date
        GROUP BY tag`;
      return new Map(rows.map((r) => [r.name, { total: Number(r.total), count: r.count }]));
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
          type: true, status: true, nature: true, amount: true, description: true, dueDate: true, paidDate: true, tags: true,
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
          // A renomeação das tags grava sem ordem (sub-projeto 13).
          tags: [...r.tags].sort(compareTags),
        }))
        .sort((a, b) => a.date.localeCompare(b.date) || a.description.localeCompare(b.description, 'pt-BR'));
    },
  };
}

export type ReportsRepository = ReturnType<typeof createReportsRepository>;
