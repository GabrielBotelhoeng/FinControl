import type { DateOnly } from '@fincontrol/shared';
import { fromDateOnly, toDateOnly } from '../../infra/date-mapping';
import type { Db } from '../../infra/prisma';

export type PendingBill = { id: string; description: string; amount: number; dueDate: DateOnly };
export type NotificationMemory = { key: string; firstSeenAt: Date; readAt: Date | null };

export function createNotificationsRepository(db: Db) {
  return {
    /** N4 (a, b): despesas pendentes (parcelas de empréstimo inclusive) até `until`, em contas não arquivadas. */
    async pendingBills(userId: string, until: DateOnly): Promise<PendingBill[]> {
      const rows = await db.transaction.findMany({
        where: { userId, type: 'expense', status: 'pending', dueDate: { lte: fromDateOnly(until) }, account: { archivedAt: null } },
        select: { id: true, description: true, amount: true, dueDate: true },
        orderBy: [{ dueDate: 'asc' }, { id: 'asc' }],
      });
      return rows.map((r) => ({ id: r.id, description: r.description, amount: Number(r.amount), dueDate: toDateOnly(r.dueDate) }));
    },

    /**
     * N2: registra os avisos ativos agora (cria os novos, renova `lastActiveAt` dos que já existiam) e devolve a
     * memória de cada um.
     */
    async touch(userId: string, keys: string[], now: Date): Promise<Map<string, NotificationMemory>> {
      if (keys.length === 0) return new Map();
      await db.notification.createMany({ data: keys.map((key) => ({ userId, key, firstSeenAt: now, lastActiveAt: now })), skipDuplicates: true });
      await db.notification.updateMany({ where: { userId, key: { in: keys } }, data: { lastActiveAt: now } });
      const rows = await db.notification.findMany({ where: { userId, key: { in: keys } }, select: { key: true, firstSeenAt: true, readAt: true } });
      return new Map(rows.map((r) => [r.key, r]));
    },

    async markRead(userId: string, keys: string[], now: Date): Promise<void> {
      await db.notification.updateMany({ where: { userId, key: { in: keys }, readAt: null }, data: { readAt: now } });
    },

    /** N8: apaga a memória dos avisos inativos há mais de `days` dias. */
    async purgeInactive(now: Date, days: number): Promise<number> {
      const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
      const { count } = await db.notification.deleteMany({ where: { lastActiveAt: { lt: cutoff } } });
      return count;
    },
  };
}

export type NotificationsRepository = ReturnType<typeof createNotificationsRepository>;
