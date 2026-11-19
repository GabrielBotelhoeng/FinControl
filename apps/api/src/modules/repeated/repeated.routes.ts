import { addDays, detectRepeatedSpending, todayInSaoPaulo, type RepeatedSpending } from '@fincontrol/shared';
import { Router } from 'express';
import { userIdOf } from '../../http/auth';
import { fromDateOnly, toDateOnly } from '../../infra/date-mapping';
import type { Db } from '../../infra/prisma';

/**
 * Gastos que se repetem (sub-projeto 10, S3): despesas pagas dos últimos 6 meses, inclusive no cartão, sem as
 * parcelas de compra, empréstimo e acordo (essas já têm fim e já aparecem em outras telas).
 */
export function createRepeatedService(deps: { db: Db; clock: () => Date }) {
  return {
    async list(userId: string): Promise<RepeatedSpending[]> {
      const today = todayInSaoPaulo(deps.clock());
      const rows = await deps.db.transaction.findMany({
        where: {
          userId, type: 'expense', status: 'paid', loanId: null, debtId: null, installmentGroupId: null,
          paidDate: { gte: fromDateOnly(addDays(today, -186)), lte: fromDateOnly(today) },
        },
        select: { description: true, amount: true, paidDate: true, recurrenceId: true },
      });
      return detectRepeatedSpending(
        rows.map((r) => ({ description: r.description, amount: Number(r.amount), date: toDateOnly(r.paidDate!), recurring: r.recurrenceId !== null })),
      );
    },
  };
}

export type RepeatedService = ReturnType<typeof createRepeatedService>;

export function repeatedRouter(service: RepeatedService): Router {
  const r = Router();
  r.get('/', async (_req, res) => {
    res.json(await service.list(userIdOf(res)));
  });
  return r;
}
