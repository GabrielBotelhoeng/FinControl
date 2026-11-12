import type { DateOnly } from '@fincontrol/shared';
import { fromDateOnly } from '../../infra/date-mapping';
import type { DbClient } from '../../infra/prisma';

const NO_ID = '00000000-0000-0000-0000-000000000000';

export function createDemoRepository(db: DbClient) {
  return {
    countAccounts(userId: string): Promise<number> {
      return db.account.count({ where: { userId } });
    },

    /** Paga as ocorrências de recorrência vencidas, exceto a mais recente de `keepDescription` (vira a "vencida" da demo). */
    async markRecurringPaidBefore(userId: string, today: DateOnly, keepDescription: string): Promise<void> {
      const keep = await db.transaction.findFirst({
        where: { userId, status: 'pending', recurrenceId: { not: null }, description: keepDescription, dueDate: { lt: fromDateOnly(today) } },
        orderBy: { dueDate: 'desc' },
        select: { id: true },
      });
      await db.$executeRaw`
        UPDATE "transactions"
        SET "status" = 'paid', "paid_date" = "due_date", "updated_at" = now()
        WHERE "user_id" = ${userId}::uuid
          AND "status" = 'pending'
          AND "recurrence_id" IS NOT NULL
          AND "due_date" < ${today}::date
          AND "id" <> ${keep?.id ?? NO_ID}::uuid`;
    },

    async staleDemoProfileIds(cutoff: Date, limit: number): Promise<string[]> {
      const rows = await db.profile.findMany({ where: { isDemo: true, createdAt: { lt: cutoff } }, select: { id: true }, take: limit });
      return rows.map((r) => r.id);
    },
  };
}

export type DemoRepository = ReturnType<typeof createDemoRepository>;
