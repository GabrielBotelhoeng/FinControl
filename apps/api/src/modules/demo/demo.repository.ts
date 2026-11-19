import type { DateOnly, LoanKind } from '@fincontrol/shared';
import type { DemoAccountKey, DemoDebt } from '../../domain/demo-data';
import type { Prisma } from '../../generated/prisma/client';
import { DEBT_CATEGORY } from '../debts/debts.service';
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

    /** Dívida com credor da demo (V13): âncoras, negociações e o acordo com os lançamentos, em ordem de registro. */
    async createDebt(userId: string, d: DemoDebt, accountId: (key: DemoAccountKey) => string): Promise<void> {
      let tick = Date.now();
      const at = () => new Date((tick += 1));
      const debt = await db.debt.create({
        data: { userId, name: d.name, creditor: d.creditor, kind: d.kind, originalAmount: BigInt(d.originalAmount), since: fromDateOnly(d.since) },
        select: { id: true },
      });
      const events: Prisma.DebtEventCreateManyInput[] = [
        { debtId: debt.id, userId, kind: 'valuation', date: fromDateOnly(d.since), amount: BigInt(d.originalAmount), recordedAt: at() },
      ];
      for (const n of d.notes) {
        events.push({ debtId: debt.id, userId, kind: 'note', date: fromDateOnly(n.date), note: n.text, amount: n.amount === null ? null : BigInt(n.amount), recordedAt: at() });
      }
      if (d.valuation) events.push({ debtId: debt.id, userId, kind: 'valuation', date: fromDateOnly(d.valuation.date), amount: BigInt(d.valuation.amount), recordedAt: at() });
      const a = d.agreement;
      if (a) {
        const n = a.schedule.length;
        events.push({
          debtId: debt.id, userId, kind: 'agreement', date: fromDateOnly(a.date), recordedAt: at(), amount: BigInt(a.downPayment + n * a.installmentAmount),
          downPayment: BigInt(a.downPayment), installments: n, installmentAmount: BigInt(a.installmentAmount),
        });
      }
      await db.debtEvent.createMany({ data: events });
      if (!a) return;
      await db.category.createMany({ data: [{ ...DEBT_CATEGORY, userId }], skipDuplicates: true });
      const category = await db.category.findFirstOrThrow({ where: { userId, type: 'expense', name: DEBT_CATEGORY.name }, select: { id: true } });
      const base = { userId, debtId: debt.id, type: 'expense' as const, accountId: accountId(a.accountKey), categoryId: category.id };
      await db.transaction.createMany({
        data: [
          {
            ...base, amount: BigInt(a.downPayment), description: `Entrada do acordo ${d.name}`, nature: 'variable', status: 'paid',
            dueDate: fromDateOnly(a.date), paidDate: fromDateOnly(a.date), installmentNumber: 0, createdAt: at(),
          },
          ...a.schedule.map((s) => ({
            ...base, amount: BigInt(a.installmentAmount), description: `Acordo ${d.name} (${s.number}/${a.schedule.length})`, nature: 'fixed' as const,
            status: s.paid ? ('paid' as const) : ('pending' as const), dueDate: fromDateOnly(s.dueDate), paidDate: s.paid ? fromDateOnly(s.dueDate) : null,
            installmentNumber: s.number, installmentTotal: a.schedule.length, createdAt: at(),
          })),
        ],
      });
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
