import type { DateOnly, Frequency, TransactionNature, TransactionType } from '@fincontrol/shared';
import type { Prisma } from '../../generated/prisma/client';
import { fromDateOnly, toDateOnly } from '../../infra/date-mapping';
import type { DbClient } from '../../infra/prisma';

export type RecurrenceTemplate = {
  type: TransactionType;
  amount: number;
  description: string;
  accountId: string;
  destinationAccountId: string | null;
  categoryId: string | null;
  nature: TransactionNature | null;
};

export type RecurrenceRow = RecurrenceTemplate & {
  id: string;
  frequency: Frequency;
  startDate: DateOnly;
  endDate: DateOnly | null;
};

type RecurrenceData = Omit<RecurrenceRow, 'id'>;

type RecurrenceRecord = Omit<RecurrenceRow, 'amount' | 'startDate' | 'endDate'> & {
  amount: bigint;
  startDate: Date;
  endDate: Date | null;
};

const toRow = (r: RecurrenceRecord): RecurrenceRow => ({
  id: r.id,
  frequency: r.frequency,
  startDate: toDateOnly(r.startDate),
  endDate: r.endDate ? toDateOnly(r.endDate) : null,
  type: r.type,
  amount: Number(r.amount),
  description: r.description,
  accountId: r.accountId,
  destinationAccountId: r.destinationAccountId,
  categoryId: r.categoryId,
  nature: r.nature,
});

function toUpdateData(p: Partial<RecurrenceData>): Prisma.RecurrenceUncheckedUpdateInput {
  const { amount, startDate, endDate, ...rest } = p;
  return {
    ...rest,
    ...(amount !== undefined ? { amount: BigInt(amount) } : {}),
    ...(startDate !== undefined ? { startDate: fromDateOnly(startDate) } : {}),
    ...(endDate !== undefined ? { endDate: endDate === null ? null : fromDateOnly(endDate) } : {}),
  };
}

export function createRecurrencesRepository(db: DbClient) {
  return {
    async create(userId: string, d: RecurrenceData): Promise<RecurrenceRow> {
      const row = await db.recurrence.create({
        data: {
          userId,
          frequency: d.frequency,
          startDate: fromDateOnly(d.startDate),
          endDate: d.endDate ? fromDateOnly(d.endDate) : null,
          type: d.type,
          amount: BigInt(d.amount),
          description: d.description,
          accountId: d.accountId,
          destinationAccountId: d.destinationAccountId,
          categoryId: d.categoryId,
          nature: d.nature,
        },
      });
      return toRow(row);
    },

    async findById(userId: string, id: string): Promise<RecurrenceRow | null> {
      const row = await db.recurrence.findFirst({ where: { id, userId } });
      return row ? toRow(row) : null;
    },

    async update(userId: string, id: string, patch: Partial<RecurrenceData>): Promise<void> {
      await db.recurrence.update({ where: { id, userId }, data: toUpdateData(patch) });
    },

    async delete(userId: string, id: string): Promise<void> {
      await db.recurrence.delete({ where: { id, userId } });
    },

    /** Séries que podem gerar ocorrências até `until`: nunca em conta (origem ou destino) arquivada. */
    async listForMaterialization(userId: string, until: DateOnly): Promise<RecurrenceRow[]> {
      const rows = await db.recurrence.findMany({
        where: {
          userId,
          startDate: { lte: fromDateOnly(until) },
          account: { archivedAt: null },
          OR: [{ destinationAccountId: null }, { destinationAccount: { archivedAt: null } }],
        },
      });
      return rows.map(toRow);
    },

    async skipsFor(recurrenceIds: string[]): Promise<Map<string, Set<DateOnly>>> {
      const rows = await db.recurrenceSkip.findMany({ where: { recurrenceId: { in: recurrenceIds } } });
      const map = new Map<string, Set<DateOnly>>();
      for (const r of rows) {
        const set = map.get(r.recurrenceId) ?? new Set<DateOnly>();
        set.add(toDateOnly(r.occurrenceDate));
        map.set(r.recurrenceId, set);
      }
      return map;
    },

    async addSkip(recurrenceId: string, occurrenceDate: DateOnly): Promise<void> {
      await db.recurrenceSkip.createMany({
        data: [{ recurrenceId, occurrenceDate: fromDateOnly(occurrenceDate) }],
        skipDuplicates: true,
      });
    },

    async deletePendingFrom(userId: string, recurrenceId: string, fromDate: DateOnly): Promise<void> {
      await db.transaction.deleteMany({
        where: { userId, recurrenceId, status: 'pending', occurrenceDate: { gte: fromDateOnly(fromDate) } },
      });
    },

    /** Move para a nova série as ocorrências restantes (as pagas) a partir de `fromDate`. */
    async relinkFrom(userId: string, fromId: string, toId: string, fromDate: DateOnly): Promise<void> {
      await db.transaction.updateMany({
        where: { userId, recurrenceId: fromId, occurrenceDate: { gte: fromDateOnly(fromDate) } },
        data: { recurrenceId: toId },
      });
    },

    countTransactions(userId: string, recurrenceId: string): Promise<number> {
      return db.transaction.count({ where: { userId, recurrenceId } });
    },
  };
}

export type RecurrencesRepository = ReturnType<typeof createRecurrencesRepository>;
