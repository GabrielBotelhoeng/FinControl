import { todayInSaoPaulo, type ContributionInput, type DateOnly, type GoalContributionDTO } from '@fincontrol/shared';
import { fromDateOnly, toDateOnly } from '../../infra/date-mapping';
import type { Db } from '../../infra/prisma';

export type GoalRow = { id: string; name: string; targetAmount: number; targetDate: DateOnly; createdAt: DateOnly; saved: number };

type GoalRecord = { id: string; name: string; targetAmount: bigint; targetDate: Date; createdAt: Date };

/** `createdAt` vira a data em São Paulo: é o início do prazo da meta (P7). */
const toRow = (g: GoalRecord, saved: number): GoalRow => ({
  id: g.id, name: g.name, targetAmount: Number(g.targetAmount), targetDate: toDateOnly(g.targetDate),
  createdAt: todayInSaoPaulo(g.createdAt), saved,
});

export class WithdrawalTooLargeError extends Error {}
export class NegativeBalanceError extends Error {}

export function createGoalsRepository(db: Db) {
  async function savedByGoal(goalIds: string[]): Promise<Map<string, number>> {
    const groups = await db.goalContribution.groupBy({ by: ['goalId'], where: { goalId: { in: goalIds } }, _sum: { amount: true } });
    return new Map(groups.map((g) => [g.goalId, Number(g._sum.amount ?? 0n)]));
  }

  return {
    async list(userId: string): Promise<GoalRow[]> {
      const goals = await db.goal.findMany({ where: { userId }, orderBy: [{ targetDate: 'asc' }, { createdAt: 'asc' }] });
      const saved = await savedByGoal(goals.map((g) => g.id));
      return goals.map((g) => toRow(g, saved.get(g.id) ?? 0));
    },

    async findById(userId: string, id: string): Promise<GoalRow | null> {
      const goal = await db.goal.findFirst({ where: { id, userId } });
      if (!goal) return null;
      return toRow(goal, (await savedByGoal([id])).get(id) ?? 0);
    },

    async create(userId: string, g: { name: string; targetAmount: number; targetDate: DateOnly }, createdAt?: Date): Promise<string> {
      const created = await db.goal.create({
        data: { userId, name: g.name, targetAmount: BigInt(g.targetAmount), targetDate: fromDateOnly(g.targetDate), ...(createdAt ? { createdAt } : {}) },
        select: { id: true },
      });
      return created.id;
    },

    async update(userId: string, id: string, g: { name?: string; targetAmount?: number; targetDate?: DateOnly }): Promise<void> {
      await db.goal.update({
        where: { id, userId },
        data: {
          ...(g.name !== undefined ? { name: g.name } : {}),
          ...(g.targetAmount !== undefined ? { targetAmount: BigInt(g.targetAmount) } : {}),
          ...(g.targetDate !== undefined ? { targetDate: fromDateOnly(g.targetDate) } : {}),
        },
      });
    },

    async delete(userId: string, id: string): Promise<void> {
      await db.goal.delete({ where: { id, userId } });
    },

    async contributions(goalId: string): Promise<GoalContributionDTO[]> {
      const rows = await db.goalContribution.findMany({ where: { goalId }, orderBy: [{ date: 'desc' }, { createdAt: 'desc' }] });
      return rows.map((r) => ({ id: r.id, amount: Number(r.amount), date: toDateOnly(r.date), note: r.note }));
    },

    /** Grava o depósito; numa retirada, confere o guardado na mesma transação (o saldo da meta nunca fica negativo). */
    async addContribution(userId: string, goalId: string, c: ContributionInput): Promise<GoalContributionDTO> {
      return db.$transaction(async (tx) => {
        // Trava a meta: duas retiradas simultâneas não passam juntas pela conferência do saldo (revisão final).
        await tx.$queryRaw`SELECT "id" FROM "goals" WHERE "id" = ${goalId}::uuid FOR UPDATE`;
        if (c.amount < 0) {
          const sum = await tx.goalContribution.aggregate({ where: { goalId }, _sum: { amount: true } });
          if (Number(sum._sum.amount ?? 0n) + c.amount < 0) throw new WithdrawalTooLargeError();
        }
        const row = await tx.goalContribution.create({
          data: { goalId, userId, amount: BigInt(c.amount), date: fromDateOnly(c.date), note: c.note ?? null },
        });
        return { id: row.id, amount: Number(row.amount), date: toDateOnly(row.date), note: row.note };
      });
    },

    /** Apagar um depósito não pode deixar o saldo negativo (ex.: depósito já retirado); mesma trava da meta. */
    async deleteContribution(userId: string, goalId: string, contributionId: string): Promise<boolean> {
      return db.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT "id" FROM "goals" WHERE "id" = ${goalId}::uuid FOR UPDATE`;
        const row = await tx.goalContribution.findFirst({ where: { id: contributionId, goalId, userId }, select: { amount: true } });
        if (!row) return false;
        if (row.amount > 0n) {
          const sum = await tx.goalContribution.aggregate({ where: { goalId }, _sum: { amount: true } });
          if ((sum._sum.amount ?? 0n) - row.amount < 0n) throw new NegativeBalanceError();
        }
        await tx.goalContribution.delete({ where: { id: contributionId } });
        return true;
      });
    },
  };
}

export type GoalsRepository = ReturnType<typeof createGoalsRepository>;
