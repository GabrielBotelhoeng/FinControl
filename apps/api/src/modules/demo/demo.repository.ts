import type { DateOnly, LoanKind } from '@fincontrol/shared';
import { fromDateOnly } from '../../infra/date-mapping';
import type { DbClient } from '../../infra/prisma';

const NO_ID = '00000000-0000-0000-0000-000000000000';

export function createDemoRepository(db: DbClient) {
  return {
    /** Serializa seeds do mesmo usuário até o fim da transação (o lock é liberado no commit ou rollback). */
    async lockSeed(userId: string): Promise<void> {
      await db.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${userId}))`;
    },

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

    /** Empréstimo da demo, dentro da transação do seed (as parcelas entram depois, com o `loanId` devolvido). */
    async createLoan(
      userId: string,
      l: {
        name: string; kind: LoanKind; bankName: string; bankCnpj8: string; principal: number; installmentAmount: number;
        installmentsTotal: number; installmentsPaidBefore: number; firstDueDate: DateOnly; accountId: string;
      },
    ): Promise<string> {
      const created = await db.loan.create({
        data: {
          ...l, userId, principal: BigInt(l.principal), installmentAmount: BigInt(l.installmentAmount), firstDueDate: fromDateOnly(l.firstDueDate),
        },
        select: { id: true },
      });
      return created.id;
    },

    async createBudget(userId: string, categoryId: string, limit: number): Promise<void> {
      await db.budget.create({ data: { userId, categoryId, limitAmount: BigInt(limit) } });
    },

    /** Meta da demo com `createdAt` no passado (o início do prazo, P7) e os depósitos. */
    async createGoal(
      userId: string,
      g: { name: string; targetAmount: number; targetDate: DateOnly; createdAt: DateOnly; contributions: { amount: number; date: DateOnly }[] },
    ): Promise<void> {
      const goal = await db.goal.create({
        data: {
          userId, name: g.name, targetAmount: BigInt(g.targetAmount), targetDate: fromDateOnly(g.targetDate),
          // Meio-dia em São Paulo (15:00 UTC): a data local é a do plano.
          createdAt: new Date(`${g.createdAt}T15:00:00Z`),
        },
        select: { id: true },
      });
      await db.goalContribution.createMany({
        data: g.contributions.map((c) => ({ goalId: goal.id, userId, amount: BigInt(c.amount), date: fromDateOnly(c.date) })),
      });
    },

    async staleDemoProfileIds(cutoff: Date, limit: number): Promise<string[]> {
      const rows = await db.profile.findMany({ where: { isDemo: true, createdAt: { lt: cutoff } }, select: { id: true }, take: limit });
      return rows.map((r) => r.id);
    },
  };
}

export type DemoRepository = ReturnType<typeof createDemoRepository>;
