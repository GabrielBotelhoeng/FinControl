import type { DateOnly } from '@fincontrol/shared';
import { fromDateOnly } from '../../infra/date-mapping';
import type { Db } from '../../infra/prisma';

/** Uso do assistente por pessoa e dia (A9). */
export function createAssistantRepository(db: Db) {
  return {
    /**
     * Reserva a vaga da pergunta ANTES de chamar a IA (auditoria final): soma 1 e confere o limite na mesma
     * transação, com o dia travado. Perguntas ao mesmo tempo não passam todas pela conferência antes de contar.
     */
    async reserve(userId: string, day: DateOnly, limits: { user: number; total: number }): Promise<'ok' | 'user' | 'total'> {
      const date = fromDateOnly(day);
      return db.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('ai_usage'), hashtext(${day}))`;
        const [mine, all] = await Promise.all([
          tx.aiUsage.findUnique({ where: { userId_day: { userId, day: date } }, select: { requests: true } }),
          tx.aiUsage.aggregate({ where: { day: date }, _sum: { requests: true } }),
        ]);
        if ((mine?.requests ?? 0) >= limits.user) return 'user';
        if ((all._sum.requests ?? 0) >= limits.total) return 'total';
        await tx.aiUsage.upsert({
          where: { userId_day: { userId, day: date } },
          create: { userId, day: date, requests: 1 },
          update: { requests: { increment: 1 } },
        });
        return 'ok';
      });
    },

    /** Tokens gastos numa pergunta já reservada por `reserve`. */
    async record(userId: string, day: DateOnly, inputTokens: number, outputTokens: number): Promise<void> {
      const date = fromDateOnly(day);
      await db.aiUsage.update({
        where: { userId_day: { userId, day: date } },
        data: { inputTokens: { increment: inputTokens }, outputTokens: { increment: outputTokens } },
      });
    },
  };
}

export type AssistantRepository = ReturnType<typeof createAssistantRepository>;
