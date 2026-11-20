import { addMonthsToYm, monthOf, startOfMonth, type AccountType, type YearMonth } from '@fincontrol/shared';
import { ZERO_FLOWS, type AccountFlows } from '../../domain/balance';
import { fromDateOnly, toDateOnly } from '../../infra/date-mapping';
import type { DbClient } from '../../infra/prisma';

export type AccountRow = {
  id: string;
  name: string;
  type: AccountType;
  color: string;
  initialBalance: number;
  creditLimit: number | null;
  closingDay: number | null;
  dueDay: number | null;
  paymentAccountId: string | null;
  archivedAt: Date | null;
  createdAt: Date;
};

type AccountRecord = Omit<AccountRow, 'initialBalance' | 'creditLimit'> & { initialBalance: bigint; creditLimit: bigint | null };
type AccountData = {
  name: string;
  type: AccountType;
  color: string;
  initialBalance: number;
  creditLimit?: number | null;
  closingDay?: number | null;
  dueDay?: number | null;
  paymentAccountId?: string | null;
};

const toRow = (a: AccountRecord): AccountRow => ({
  id: a.id, name: a.name, type: a.type, color: a.color,
  initialBalance: Number(a.initialBalance),
  creditLimit: a.creditLimit === null ? null : Number(a.creditLimit),
  closingDay: a.closingDay, dueDay: a.dueDay, paymentAccountId: a.paymentAccountId,
  archivedAt: a.archivedAt, createdAt: a.createdAt,
});

export function createAccountsRepository(db: DbClient) {
  /**
   * Valor e pago de faturas de cartão entre dois meses, inclusive, agrupados por `invoiceMonth` (decisão R13):
   * valor = soma das despesas pagas do cartão naquele mês; pago = soma das transferências pagas para o cartão
   * no mesmo mês. Consulta única reaproveitada pelo DTO de conta (Tarefa 5) e pelas faturas (Tarefa 7, lista e
   * detalhe, via `invoiceTotals` abaixo); a Tarefa 8 usa para o painel.
   * Auditoria final (M3): o que foi pago a mais numa fatura entra como pago na seguinte (e assim por diante),
   * por isso a soma começa na primeira fatura do cartão e só o intervalo pedido volta.
   */
  async function invoiceTotalsByMonth(
    userId: string,
    cardAccountId: string,
    fromMonth: YearMonth,
    toMonth: YearMonth,
  ): Promise<Map<YearMonth, { amount: number; paid: number }>> {
    const range = { lte: fromDateOnly(startOfMonth(toMonth)) };
    const [spent, paid] = await Promise.all([
      db.transaction.groupBy({
        by: ['invoiceMonth'],
        where: { userId, accountId: cardAccountId, type: 'expense', status: 'paid', invoiceMonth: range },
        _sum: { amount: true },
      }),
      db.transaction.groupBy({
        by: ['invoiceMonth'],
        where: { userId, destinationAccountId: cardAccountId, type: 'transfer', status: 'paid', invoiceMonth: range },
        _sum: { amount: true },
      }),
    ]);
    const result = new Map<YearMonth, { amount: number; paid: number }>();
    const at = (ym: YearMonth): { amount: number; paid: number } => {
      let v = result.get(ym);
      if (!v) {
        v = { amount: 0, paid: 0 };
        result.set(ym, v);
      }
      return v;
    };
    for (const g of spent) if (g.invoiceMonth) at(monthOf(toDateOnly(g.invoiceMonth))).amount = Number(g._sum.amount ?? 0n);
    for (const g of paid) if (g.invoiceMonth) at(monthOf(toDateOnly(g.invoiceMonth))).paid = Number(g._sum.amount ?? 0n);
    // Todo mês do intervalo existe, mesmo sem movimento: o crédito também aparece numa fatura vazia (CodeRabbit).
    for (let ym = fromMonth; ym <= toMonth; ym = addMonthsToYm(ym, 1)) at(ym);
    let credit = 0;
    for (const ym of [...result.keys()].sort()) {
      const v = result.get(ym)!;
      v.paid += credit;
      credit = Math.max(v.paid - v.amount, 0);
      if (ym < fromMonth) result.delete(ym);
    }
    return result;
  }

  return {
    async list(userId: string, includeArchived: boolean): Promise<AccountRow[]> {
      const rows = await db.account.findMany({
        where: { userId, ...(includeArchived ? {} : { archivedAt: null }) },
        orderBy: { createdAt: 'asc' },
      });
      return rows.map(toRow);
    },

    async findById(userId: string, id: string): Promise<AccountRow | null> {
      const row = await db.account.findFirst({ where: { id, userId } });
      return row ? toRow(row) : null;
    },

    async findActiveByName(userId: string, name: string, exceptId?: string): Promise<AccountRow | null> {
      const row = await db.account.findFirst({
        where: {
          userId, archivedAt: null, name: { equals: name, mode: 'insensitive' },
          ...(exceptId ? { NOT: { id: exceptId } } : {}),
        },
      });
      return row ? toRow(row) : null;
    },

    async create(userId: string, data: AccountData): Promise<AccountRow> {
      return toRow(await db.account.create({ data: { ...data, initialBalance: BigInt(data.initialBalance), userId } }));
    },

    async update(userId: string, id: string, data: Partial<AccountData>): Promise<AccountRow> {
      const { initialBalance, ...rest } = data;
      return toRow(
        await db.account.update({
          where: { id, userId },
          data: { ...rest, ...(initialBalance !== undefined ? { initialBalance: BigInt(initialBalance) } : {}) },
        }),
      );
    },

    async setArchived(userId: string, id: string, archivedAt: Date | null): Promise<AccountRow> {
      return toRow(await db.account.update({ where: { id, userId }, data: { archivedAt } }));
    },

    async delete(userId: string, id: string): Promise<void> {
      await db.account.delete({ where: { id, userId } });
    },

    /** Nome de uma dívida com parcela de acordo pendente nesta conta, ou `null` (bloqueia o arquivamento, V7). */
    async pendingDebtName(userId: string, id: string): Promise<string | null> {
      const row = await db.transaction.findFirst({
        where: { userId, accountId: id, status: 'pending', debtId: { not: null }, installmentNumber: { not: null } },
        select: { debt: { select: { name: true } } },
      });
      return row?.debt?.name ?? null;
    },

    /** Nome de um empréstimo com parcela pendente nesta conta, ou `null` (bloqueia o arquivamento). */
    async pendingLoanName(userId: string, id: string): Promise<string | null> {
      const row = await db.transaction.findFirst({
        where: { userId, accountId: id, status: 'pending', loanId: { not: null } },
        select: { loan: { select: { name: true } } },
      });
      return row?.loan?.name ?? null;
    },

    async isReferenced(userId: string, id: string): Promise<boolean> {
      const where = { userId, OR: [{ accountId: id }, { destinationAccountId: id }] };
      const [transactions, recurrences, loans] = await Promise.all([
        db.transaction.count({ where }),
        db.recurrence.count({ where }),
        // Empréstimo pago por esta conta (FK NO ACTION): sem isto, excluir a conta daria 500 em vez de 409.
        db.loan.count({ where: { userId, accountId: id } }),
      ]);
      return transactions + recurrences + loans > 0;
    },

    /** Conta pagadora de algum cartão do usuário (inclusive arquivado). */
    async paysACard(userId: string, id: string): Promise<boolean> {
      return (await db.account.count({ where: { userId, paymentAccountId: id } })) > 0;
    },

    async flowsByAccount(userId: string): Promise<Map<string, AccountFlows>> {
      const flows = new Map<string, AccountFlows>();
      const get = (id: string): AccountFlows => {
        let f = flows.get(id);
        if (!f) {
          f = { ...ZERO_FLOWS };
          flows.set(id, f);
        }
        return f;
      };

      const own = await db.transaction.groupBy({
        by: ['accountId', 'type'],
        where: { userId, status: 'paid' },
        _sum: { amount: true },
      });
      for (const g of own) {
        const value = Number(g._sum.amount ?? 0n);
        const f = get(g.accountId);
        if (g.type === 'income') f.incomePaid += value;
        else if (g.type === 'expense') f.expensePaid += value;
        else f.transferOutPaid += value;
      }

      const incoming = await db.transaction.groupBy({
        by: ['destinationAccountId'],
        where: { userId, status: 'paid', type: 'transfer' },
        _sum: { amount: true },
      });
      for (const g of incoming) {
        if (g.destinationAccountId) get(g.destinationAccountId).transferInPaid += Number(g._sum.amount ?? 0n);
      }
      return flows;
    },

    invoiceTotalsByMonth,

    /**
     * Valor e pago de UMA fatura de cartão num mês (decisão R13): atalho de `invoiceTotalsByMonth` para um
     * único mês, usado pelo DTO de conta (limite/fatura aberta/próximo vencimento) e pelo detalhe de fatura
     * (Tarefa 7).
     */
    async invoiceTotals(userId: string, cardAccountId: string, invoiceMonth: YearMonth): Promise<{ amount: number; paid: number }> {
      const totals = await invoiceTotalsByMonth(userId, cardAccountId, invoiceMonth, invoiceMonth);
      return totals.get(invoiceMonth) ?? { amount: 0, paid: 0 };
    },
  };
}

export type AccountsRepository = ReturnType<typeof createAccountsRepository>;
