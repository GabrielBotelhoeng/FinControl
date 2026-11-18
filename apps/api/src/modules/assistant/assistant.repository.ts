import type { DateOnly } from '@fincontrol/shared';
import { fromDateOnly } from '../../infra/date-mapping';
import type { Db } from '../../infra/prisma';

/** Uso do assistente por pessoa e dia (A9). */
export function createAssistantRepository(db: Db) {
  return {
    /** Perguntas de hoje: da pessoa e de todas as contas juntas. */
    async requestsOn(userId: string, day: DateOnly): Promise<{ user: number; total: number }> {
      const date = fromDateOnly(day);
      const [mine, all] = await Promise.all([
        db.aiUsage.findUnique({ where: { userId_day: { userId, day: date } }, select: { requests: true } }),
        db.aiUsage.aggregate({ where: { day: date }, _sum: { requests: true } }),
      ]);
      return { user: mine?.requests ?? 0, total: all._sum.requests ?? 0 };
    },

    async record(userId: string, day: DateOnly, inputTokens: number, outputTokens: number): Promise<void> {
      const date = fromDateOnly(day);
      await db.aiUsage.upsert({
        where: { userId_day: { userId, day: date } },
        create: { userId, day: date, requests: 1, inputTokens, outputTokens },
        update: { requests: { increment: 1 }, inputTokens: { increment: inputTokens }, outputTokens: { increment: outputTokens } },
      });
    },
  };
}

export type AssistantRepository = ReturnType<typeof createAssistantRepository>;
