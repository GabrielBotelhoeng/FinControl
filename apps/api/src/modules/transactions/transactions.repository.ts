import type { DateOnly, TransactionNature, TransactionStatus, TransactionType } from '@fincontrol/shared';
import type { Prisma } from '../../generated/prisma/client';
import { fromDateOnly, toDateOnly } from '../../infra/date-mapping';
import type { DbClient } from '../../infra/prisma';

export type TransactionRow = {
  id: string;
  type: TransactionType;
  amount: number;
  description: string;
  accountId: string;
  destinationAccountId: string | null;
  categoryId: string | null;
  nature: TransactionNature | null;
  status: TransactionStatus;
  dueDate: DateOnly;
  paidDate: DateOnly | null;
  recurrenceId: string | null;
  occurrenceDate: DateOnly | null;
  createdAt: Date;
};

export type NewTransaction = Omit<TransactionRow, 'id' | 'createdAt'>;

export type TransactionFilters = {
  from?: DateOnly;
  to?: DateOnly;
  accountId?: string;
  categoryId?: string;
  type?: TransactionType;
  status?: TransactionStatus;
  q?: string;
};

export type Cursor = { dueDate: DateOnly; id: string };

type TransactionRecord = Omit<TransactionRow, 'amount' | 'dueDate' | 'paidDate' | 'occurrenceDate'> & {
  amount: bigint;
  dueDate: Date;
  paidDate: Date | null;
  occurrenceDate: Date | null;
};

const optDate = (d: Date | null): DateOnly | null => (d ? toDateOnly(d) : null);
const optDateIn = (d: DateOnly | null): Date | null => (d ? fromDateOnly(d) : null);

export const toTransactionRow = (t: TransactionRecord): TransactionRow => ({
  id: t.id,
  type: t.type,
  amount: Number(t.amount),
  description: t.description,
  accountId: t.accountId,
  destinationAccountId: t.destinationAccountId,
  categoryId: t.categoryId,
  nature: t.nature,
  status: t.status,
  dueDate: toDateOnly(t.dueDate),
  paidDate: optDate(t.paidDate),
  recurrenceId: t.recurrenceId,
  occurrenceDate: optDate(t.occurrenceDate),
  createdAt: t.createdAt,
});

const toCreateData = (userId: string, t: NewTransaction): Prisma.TransactionCreateManyInput => ({
  ...t,
  userId,
  amount: BigInt(t.amount),
  dueDate: fromDateOnly(t.dueDate),
  paidDate: optDateIn(t.paidDate),
  occurrenceDate: optDateIn(t.occurrenceDate),
});

function toUpdateData(p: Partial<NewTransaction>): Prisma.TransactionUncheckedUpdateInput {
  const { amount, dueDate, paidDate, occurrenceDate, ...rest } = p;
  return {
    ...rest,
    ...(amount !== undefined ? { amount: BigInt(amount) } : {}),
    ...(dueDate !== undefined ? { dueDate: fromDateOnly(dueDate) } : {}),
    ...(paidDate !== undefined ? { paidDate: optDateIn(paidDate) } : {}),
    ...(occurrenceDate !== undefined ? { occurrenceDate: optDateIn(occurrenceDate) } : {}),
  };
}

/** O Prisma monta `ILIKE '%…%'` sem escapar o termo; sem isto, `%` e `_` da busca virariam curingas. */
const escapeLike = (term: string) => term.replace(/[\\%_]/g, (c) => `\\${c}`);

export function createTransactionsRepository(db: DbClient) {
  return {
    async list(userId: string, f: TransactionFilters, cursor: Cursor | undefined, take: number): Promise<TransactionRow[]> {
      const and: Prisma.TransactionWhereInput[] = [];
      if (f.from) and.push({ dueDate: { gte: fromDateOnly(f.from) } });
      if (f.to) and.push({ dueDate: { lte: fromDateOnly(f.to) } });
      if (f.accountId) and.push({ OR: [{ accountId: f.accountId }, { destinationAccountId: f.accountId }] });
      if (f.categoryId) and.push({ categoryId: f.categoryId });
      if (f.type) and.push({ type: f.type });
      if (f.status) and.push({ status: f.status });
      if (f.q) and.push({ description: { contains: escapeLike(f.q), mode: 'insensitive' } });
      if (cursor) {
        const d = fromDateOnly(cursor.dueDate);
        and.push({ OR: [{ dueDate: { lt: d } }, { dueDate: d, id: { lt: cursor.id } }] });
      }
      const rows = await db.transaction.findMany({
        where: { userId, AND: and },
        orderBy: [{ dueDate: 'desc' }, { id: 'desc' }],
        take,
      });
      return rows.map(toTransactionRow);
    },

    async findById(userId: string, id: string): Promise<TransactionRow | null> {
      const row = await db.transaction.findFirst({ where: { id, userId } });
      return row ? toTransactionRow(row) : null;
    },

    async findByOccurrence(userId: string, recurrenceId: string, occurrenceDate: DateOnly): Promise<TransactionRow | null> {
      const row = await db.transaction.findFirst({ where: { userId, recurrenceId, occurrenceDate: fromDateOnly(occurrenceDate) } });
      return row ? toTransactionRow(row) : null;
    },

    async create(userId: string, t: NewTransaction): Promise<TransactionRow> {
      return toTransactionRow(await db.transaction.create({ data: toCreateData(userId, t) }));
    },

    async update(userId: string, id: string, patch: Partial<NewTransaction>): Promise<TransactionRow> {
      return toTransactionRow(await db.transaction.update({ where: { id, userId }, data: toUpdateData(patch) }));
    },

    async delete(userId: string, id: string): Promise<void> {
      await db.transaction.delete({ where: { id, userId } });
    },

    /** Insere ignorando duplicatas de (recurrence_id, occurrence_date): é a base da materialização idempotente. */
    async insertMany(userId: string, rows: NewTransaction[]): Promise<void> {
      if (rows.length === 0) return;
      await db.transaction.createMany({ data: rows.map((r) => toCreateData(userId, r)), skipDuplicates: true });
    },

    /** Pendentes até `until` em contas não arquivadas, vencimento mais próximo primeiro. */
    async listPendingUntil(userId: string, until: DateOnly, limit: number): Promise<TransactionRow[]> {
      const rows = await db.transaction.findMany({
        where: { userId, status: 'pending', dueDate: { lte: fromDateOnly(until) }, account: { archivedAt: null } },
        orderBy: [{ dueDate: 'asc' }, { id: 'asc' }],
        take: limit,
      });
      return rows.map(toTransactionRow);
    },
  };
}

export type TransactionsRepository = ReturnType<typeof createTransactionsRepository>;
