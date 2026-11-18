import type { DateOnly, DebtKind, DebtLedger } from '@fincontrol/shared';
import { fromDateOnly, toDateOnly } from '../../infra/date-mapping';
import type { Db, DbClient } from '../../infra/prisma';

export type DebtRow = { id: string; name: string; creditor: string; kind: DebtKind; originalAmount: number; since: DateOnly };

export type DebtEventRow =
  | { kind: 'valuation'; id: string; date: DateOnly; recordedAt: Date; amount: number; note: string | null }
  | { kind: 'note'; id: string; date: DateOnly; recordedAt: Date; amount: number | null; note: string }
  | {
      kind: 'agreement'; id: string; date: DateOnly; recordedAt: Date; amount: number;
      downPayment: number; installments: number; installmentAmount: number; cancelledAt: Date | null;
    };

/** Lançamento de uma dívida: pagamento (pago) ou parcela de acordo (`installmentNumber`), paga ou pendente. */
export type DebtTransactionRow = {
  id: string; amount: number; description: string; status: 'pending' | 'paid'; dueDate: DateOnly; paidDate: DateOnly | null;
  installmentNumber: number | null; createdAt: Date;
};

export type DebtData = { row: DebtRow; events: DebtEventRow[]; transactions: DebtTransactionRow[] };

export type NewDebtTransaction = {
  amount: number; description: string; accountId: string; categoryId: string; status: 'pending' | 'paid';
  dueDate: DateOnly; paidDate: DateOnly | null; installmentNumber: number | null; installmentTotal: number | null; createdAt: Date;
};

export class ActiveAgreementError extends Error {}

type EventRecord = {
  id: string; kind: 'valuation' | 'agreement' | 'note'; date: Date; recordedAt: Date; amount: bigint | null; note: string | null;
  downPayment: bigint | null; installments: number | null; installmentAmount: bigint | null; cancelledAt: Date | null;
};

function toEventRow(e: EventRecord): DebtEventRow {
  const base = { id: e.id, date: toDateOnly(e.date), recordedAt: e.recordedAt };
  if (e.kind === 'note') return { ...base, kind: 'note', note: e.note ?? '', amount: e.amount === null ? null : Number(e.amount) };
  if (e.kind === 'valuation') return { ...base, kind: 'valuation', amount: Number(e.amount), note: e.note };
  return {
    ...base, kind: 'agreement', amount: Number(e.amount), downPayment: Number(e.downPayment), installments: e.installments!,
    installmentAmount: Number(e.installmentAmount), cancelledAt: e.cancelledAt,
  };
}

const toRow = (d: { id: string; name: string; creditor: string; kind: DebtKind; originalAmount: bigint; since: Date }): DebtRow => ({
  id: d.id, name: d.name, creditor: d.creditor, kind: d.kind, originalAmount: Number(d.originalAmount), since: toDateOnly(d.since),
});

/** Âncoras = atualizações e acordos (V3); pagamentos = lançamentos pagos. É a entrada das regras de `debt.ts`. */
export function ledgerOf(data: Pick<DebtData, 'events' | 'transactions'>): DebtLedger {
  return {
    anchors: data.events
      .filter((e) => e.kind !== 'note')
      .map((e) => ({ id: e.id, date: e.date, recordedAt: e.recordedAt.toISOString(), amount: e.amount ?? 0 })),
    payments: data.transactions
      .filter((t) => t.status === 'paid' && t.paidDate)
      .map((t) => ({ id: t.id, date: t.paidDate!, recordedAt: t.createdAt.toISOString(), amount: t.amount })),
  };
}

/** A última âncora (atualização ou acordo), na ordem da regra V3. */
export function lastAnchor(events: DebtEventRow[]): Exclude<DebtEventRow, { kind: 'note' }> | null {
  let last: Exclude<DebtEventRow, { kind: 'note' }> | null = null;
  for (const e of events) {
    if (e.kind === 'note') continue;
    if (!last || e.date > last.date || (e.date === last.date && e.recordedAt > last.recordedAt)) last = e;
  }
  return last;
}

export const activeAgreement = (events: DebtEventRow[]) => {
  const last = lastAnchor(events);
  return last?.kind === 'agreement' ? last : null;
};

export function createDebtsRepository(db: Db) {
  async function load(userId: string, ids?: string[]): Promise<DebtData[]> {
    const debts = await db.debt.findMany({
      where: { userId, ...(ids ? { id: { in: ids } } : {}) },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
    if (debts.length === 0) return [];
    const debtIds = debts.map((d) => d.id);
    const [events, transactions] = await Promise.all([
      db.debtEvent.findMany({ where: { userId, debtId: { in: debtIds } } }),
      db.transaction.findMany({
        where: { userId, debtId: { in: debtIds } },
        select: {
          id: true, debtId: true, amount: true, description: true, status: true, dueDate: true, paidDate: true,
          installmentNumber: true, createdAt: true,
        },
      }),
    ]);
    return debts.map((d) => ({
      row: toRow(d),
      events: events.filter((e) => e.debtId === d.id).map(toEventRow),
      transactions: transactions
        .filter((t) => t.debtId === d.id)
        .map((t) => ({
          id: t.id, amount: Number(t.amount), description: t.description, status: t.status, dueDate: toDateOnly(t.dueDate),
          paidDate: t.paidDate ? toDateOnly(t.paidDate) : null, installmentNumber: t.installmentNumber, createdAt: t.createdAt,
        })),
    }));
  }

  const txData = (userId: string, debtId: string, t: NewDebtTransaction) => ({
    userId, debtId, type: 'expense' as const, amount: BigInt(t.amount), description: t.description, accountId: t.accountId,
    categoryId: t.categoryId, nature: (t.installmentNumber ? 'fixed' : 'variable') as 'fixed' | 'variable', status: t.status,
    dueDate: fromDateOnly(t.dueDate), paidDate: t.paidDate ? fromDateOnly(t.paidDate) : null,
    installmentNumber: t.installmentNumber, installmentTotal: t.installmentTotal, createdAt: t.createdAt,
  });

  /** Trava a dívida e confere, dentro da transação, que não há acordo ativo (duas abas não fecham dois acordos). */
  async function lockWithoutAgreement(tx: DbClient, userId: string, debtId: string) {
    await tx.$queryRaw`SELECT "id" FROM "debts" WHERE "id" = ${debtId}::uuid FOR UPDATE`;
    const events = await tx.debtEvent.findMany({ where: { userId, debtId, kind: { in: ['valuation', 'agreement'] } } });
    if (activeAgreement(events.map(toEventRow))) throw new ActiveAgreementError();
  }

  return {
    load,

    async findOne(userId: string, id: string): Promise<DebtData | null> {
      return (await load(userId, [id]))[0] ?? null;
    },

    /** Dívida e âncoras do cadastro (V4) numa transação só. */
    async create(
      userId: string,
      debt: Omit<DebtRow, 'id'>,
      anchors: { date: DateOnly; amount: number; recordedAt: Date }[],
    ): Promise<string> {
      return db.$transaction(async (tx) => {
        const created = await tx.debt.create({
          data: { userId, name: debt.name, creditor: debt.creditor, kind: debt.kind, originalAmount: BigInt(debt.originalAmount), since: fromDateOnly(debt.since) },
          select: { id: true },
        });
        await tx.debtEvent.createMany({
          data: anchors.map((a) => ({
            debtId: created.id, userId, kind: 'valuation' as const, date: fromDateOnly(a.date), amount: BigInt(a.amount), recordedAt: a.recordedAt,
          })),
        });
        return created.id;
      });
    },

    async update(userId: string, id: string, fields: Partial<Pick<DebtRow, 'name' | 'creditor' | 'kind'>>): Promise<void> {
      await db.debt.update({ where: { id, userId }, data: fields });
    },

    /** V10: apaga as parcelas pendentes e a dívida; os eventos vão em cascata e os pagamentos ficam sem o vínculo. */
    async delete(userId: string, id: string): Promise<void> {
      await db.$transaction([
        db.transaction.deleteMany({ where: { userId, debtId: id, status: 'pending' } }),
        db.debt.delete({ where: { id, userId } }),
      ]);
    },

    async addValuation(userId: string, debtId: string, v: { date: DateOnly; amount: number; note: string | null }): Promise<void> {
      await db.$transaction(async (tx) => {
        await lockWithoutAgreement(tx, userId, debtId);
        await tx.debtEvent.create({
          data: { debtId, userId, kind: 'valuation', date: fromDateOnly(v.date), amount: BigInt(v.amount), note: v.note, recordedAt: new Date() },
        });
      });
    },

    async addNote(userId: string, debtId: string, n: { date: DateOnly; text: string; amount: number | null }): Promise<void> {
      await db.debtEvent.create({
        data: { debtId, userId, kind: 'note', date: fromDateOnly(n.date), note: n.text, amount: n.amount === null ? null : BigInt(n.amount) },
      });
    },

    /** V7: âncora do acordo, entrada paga e parcelas pendentes juntas. A entrada é registrada depois da âncora. */
    async createAgreement(
      userId: string,
      debtId: string,
      a: { date: DateOnly; downPayment: number; installments: number; installmentAmount: number; recordedAt: Date },
      transactions: NewDebtTransaction[],
    ): Promise<void> {
      await db.$transaction(async (tx) => {
        await lockWithoutAgreement(tx, userId, debtId);
        await tx.debtEvent.create({
          data: {
            debtId, userId, kind: 'agreement', date: fromDateOnly(a.date), recordedAt: a.recordedAt,
            amount: BigInt(a.downPayment + a.installments * a.installmentAmount), downPayment: BigInt(a.downPayment),
            installments: a.installments, installmentAmount: BigInt(a.installmentAmount),
          },
        });
        await tx.transaction.createMany({ data: transactions.map((t) => txData(userId, debtId, t)) });
      });
    },

    /** V7: apaga as parcelas pendentes do acordo e ancora o saldo do momento numa atualização. */
    async cancelAgreement(userId: string, debtId: string, agreementId: string, v: { date: DateOnly; amount: number }): Promise<void> {
      const now = new Date();
      await db.$transaction([
        db.debtEvent.update({ where: { id: agreementId }, data: { cancelledAt: now } }),
        db.transaction.deleteMany({ where: { userId, debtId, status: 'pending', installmentNumber: { not: null } } }),
        db.debtEvent.create({
          data: { debtId, userId, kind: 'valuation', date: fromDateOnly(v.date), amount: BigInt(v.amount), note: 'Acordo cancelado', recordedAt: now },
        }),
      ]);
    },

    async addPayment(userId: string, debtId: string, t: NewDebtTransaction): Promise<void> {
      await db.$transaction(async (tx) => {
        await lockWithoutAgreement(tx, userId, debtId);
        await tx.transaction.create({ data: txData(userId, debtId, t) });
      });
    },
  };
}

export type DebtsRepository = ReturnType<typeof createDebtsRepository>;
