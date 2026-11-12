import type { AccountType } from '@fincontrol/shared';
import { ZERO_FLOWS, type AccountFlows } from '../../domain/balance';
import type { DbClient } from '../../infra/prisma';

export type AccountRow = {
  id: string;
  name: string;
  type: AccountType;
  color: string;
  initialBalance: number;
  creditLimit: number | null;
  closingDay: number | null;
  dueDay: number | null;
  paymentAccountId: string | null;
  archivedAt: Date | null;
  createdAt: Date;
};

type AccountRecord = Omit<AccountRow, 'initialBalance' | 'creditLimit'> & { initialBalance: bigint; creditLimit: bigint | null };
type AccountData = {
  name: string;
  type: AccountType;
  color: string;
  initialBalance: number;
  creditLimit?: number | null;
  closingDay?: number | null;
  dueDay?: number | null;
  paymentAccountId?: string | null;
};

const toRow = (a: AccountRecord): AccountRow => ({
  id: a.id, name: a.name, type: a.type, color: a.color,
  initialBalance: Number(a.initialBalance),
  creditLimit: a.creditLimit === null ? null : Number(a.creditLimit),
  closingDay: a.closingDay, dueDay: a.dueDay, paymentAccountId: a.paymentAccountId,
  archivedAt: a.archivedAt, createdAt: a.createdAt,
});

export function createAccountsRepository(db: DbClient) {
  return {
    async list(userId: string, includeArchived: boolean): Promise<AccountRow[]> {
      const rows = await db.account.findMany({
        where: { userId, ...(includeArchived ? {} : { archivedAt: null }) },
        orderBy: { createdAt: 'asc' },
      });
      return rows.map(toRow);
    },

    async findById(userId: string, id: string): Promise<AccountRow | null> {
      const row = await db.account.findFirst({ where: { id, userId } });
      return row ? toRow(row) : null;
    },

    async findActiveByName(userId: string, name: string, exceptId?: string): Promise<AccountRow | null> {
      const row = await db.account.findFirst({
        where: {
          userId, archivedAt: null, name: { equals: name, mode: 'insensitive' },
          ...(exceptId ? { NOT: { id: exceptId } } : {}),
        },
      });
      return row ? toRow(row) : null;
    },

    async create(userId: string, data: AccountData): Promise<AccountRow> {
      return toRow(await db.account.create({ data: { ...data, initialBalance: BigInt(data.initialBalance), userId } }));
    },

    async update(userId: string, id: string, data: Partial<AccountData>): Promise<AccountRow> {
      const { initialBalance, ...rest } = data;
      return toRow(
        await db.account.update({
          where: { id, userId },
          data: { ...rest, ...(initialBalance !== undefined ? { initialBalance: BigInt(initialBalance) } : {}) },
        }),
      );
    },

    async setArchived(userId: string, id: string, archivedAt: Date | null): Promise<AccountRow> {
      return toRow(await db.account.update({ where: { id, userId }, data: { archivedAt } }));
    },

    async delete(userId: string, id: string): Promise<void> {
      await db.account.delete({ where: { id, userId } });
    },

    /** Conta referenciada por lançamento ou recorrência (como origem ou destino). */
    async isReferenced(userId: string, id: string): Promise<boolean> {
      const where = { userId, OR: [{ accountId: id }, { destinationAccountId: id }] };
      const [transactions, recurrences] = await Promise.all([db.transaction.count({ where }), db.recurrence.count({ where })]);
      return transactions + recurrences > 0;
    },

    async flowsByAccount(userId: string): Promise<Map<string, AccountFlows>> {
      const flows = new Map<string, AccountFlows>();
      const get = (id: string): AccountFlows => {
        let f = flows.get(id);
        if (!f) {
          f = { ...ZERO_FLOWS };
          flows.set(id, f);
        }
        return f;
      };

      const own = await db.transaction.groupBy({
        by: ['accountId', 'type'],
        where: { userId, status: 'paid' },
        _sum: { amount: true },
      });
      for (const g of own) {
        const value = Number(g._sum.amount ?? 0n);
        const f = get(g.accountId);
        if (g.type === 'income') f.incomePaid += value;
        else if (g.type === 'expense') f.expensePaid += value;
        else f.transferOutPaid += value;
      }

      const incoming = await db.transaction.groupBy({
        by: ['destinationAccountId'],
        where: { userId, status: 'paid', type: 'transfer' },
        _sum: { amount: true },
      });
      for (const g of incoming) {
        if (g.destinationAccountId) get(g.destinationAccountId).transferInPaid += Number(g._sum.amount ?? 0n);
      }
      return flows;
    },
  };
}

export type AccountsRepository = ReturnType<typeof createAccountsRepository>;
