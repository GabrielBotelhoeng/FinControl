import { endOfMonth, startOfMonth, type DateOnly, type LoanKind, type YearMonth } from '@fincontrol/shared';
import { fromDateOnly, toDateOnly } from '../../infra/date-mapping';
import type { Db } from '../../infra/prisma';

export type LoanRow = {
  id: string;
  name: string;
  kind: LoanKind;
  bankName: string;
  bankCnpj8: string | null;
  principal: number;
  installmentAmount: number;
  installmentsTotal: number;
  installmentsPaidBefore: number;
  firstDueDate: DateOnly;
  accountId: string;
  informedMonthlyRate: number | null;
};

/** O que a leitura precisa além da linha: parcelas pagas no app e a próxima pendente. */
export type LoanProgress = { paidInApp: number; nextDue: { date: DateOnly; amount: number } | null };

export type NewLoan = Omit<LoanRow, 'id'>;
export type NewLoanInstallment = { number: number; dueDate: DateOnly; description: string };

type LoanRecord = Omit<LoanRow, 'principal' | 'installmentAmount' | 'firstDueDate' | 'informedMonthlyRate'> & {
  principal: bigint;
  installmentAmount: bigint;
  firstDueDate: Date;
  informedMonthlyRate: { toNumber(): number } | null;
};

const toLoanRow = (l: LoanRecord): LoanRow => ({
  id: l.id, name: l.name, kind: l.kind, bankName: l.bankName, bankCnpj8: l.bankCnpj8,
  principal: Number(l.principal), installmentAmount: Number(l.installmentAmount),
  installmentsTotal: l.installmentsTotal, installmentsPaidBefore: l.installmentsPaidBefore,
  firstDueDate: toDateOnly(l.firstDueDate), accountId: l.accountId,
  informedMonthlyRate: l.informedMonthlyRate === null ? null : l.informedMonthlyRate.toNumber(),
});

export function createLoansRepository(db: Db) {
  async function progressOf(userId: string, loanIds: string[]): Promise<Map<string, LoanProgress>> {
    const [paid, pending] = await Promise.all([
      db.transaction.groupBy({ by: ['loanId'], where: { userId, loanId: { in: loanIds }, status: 'paid' }, _count: { _all: true } }),
      db.transaction.findMany({
        where: { userId, loanId: { in: loanIds }, status: 'pending' },
        orderBy: [{ dueDate: 'asc' }, { id: 'asc' }],
        distinct: ['loanId'],
        select: { loanId: true, dueDate: true, amount: true },
      }),
    ]);
    const out = new Map<string, LoanProgress>(loanIds.map((id) => [id, { paidInApp: 0, nextDue: null }]));
    for (const p of paid) out.get(p.loanId!)!.paidInApp = p._count._all;
    for (const n of pending) out.get(n.loanId!)!.nextDue = { date: toDateOnly(n.dueDate), amount: Number(n.amount) };
    return out;
  }

  return {
    /** Empréstimo e parcelas restantes numa transação só: nunca fica um empréstimo sem as parcelas. */
    async create(
      userId: string,
      loan: NewLoan,
      installments: NewLoanInstallment[],
      categoryId: string,
    ): Promise<LoanRow> {
      return db.$transaction(async (tx) => {
        const created = await tx.loan.create({
          data: {
            ...loan, userId, principal: BigInt(loan.principal), installmentAmount: BigInt(loan.installmentAmount),
            firstDueDate: fromDateOnly(loan.firstDueDate),
          },
        });
        await tx.transaction.createMany({
          data: installments.map((i) => ({
            userId, type: 'expense' as const, amount: BigInt(loan.installmentAmount), description: i.description,
            accountId: loan.accountId, categoryId, nature: 'fixed' as const, status: 'pending' as const,
            dueDate: fromDateOnly(i.dueDate), installmentNumber: i.number, installmentTotal: loan.installmentsTotal,
            loanId: created.id,
          })),
        });
        return toLoanRow(created);
      });
    },

    async list(userId: string): Promise<LoanRow[]> {
      const rows = await db.loan.findMany({ where: { userId }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] });
      return rows.map(toLoanRow);
    },

    async findById(userId: string, id: string): Promise<LoanRow | null> {
      const row = await db.loan.findFirst({ where: { id, userId } });
      return row ? toLoanRow(row) : null;
    },

    progress: progressOf,

    async rename(userId: string, id: string, name: string): Promise<void> {
      await db.loan.update({ where: { id, userId }, data: { name } });
    },

    /** Apaga as parcelas pendentes e o empréstimo; a FK `SET NULL` desvincula as pagas, que ficam no histórico. */
    async delete(userId: string, id: string): Promise<void> {
      await db.$transaction([
        db.transaction.deleteMany({ where: { userId, loanId: id, status: 'pending' } }),
        db.loan.delete({ where: { id, userId } }),
      ]);
    },

    /** Soma das parcelas de empréstimo com vencimento no mês, pagas ou pendentes (spec C13). */
    async installmentsDueIn(userId: string, month: YearMonth): Promise<number> {
      const r = await db.transaction.aggregate({
        where: {
          userId, loanId: { not: null },
          dueDate: { gte: fromDateOnly(startOfMonth(month)), lte: fromDateOnly(endOfMonth(month)) },
        },
        _sum: { amount: true },
      });
      return Number(r._sum.amount ?? 0n);
    },
  };
}

export type LoansRepository = ReturnType<typeof createLoansRepository>;
