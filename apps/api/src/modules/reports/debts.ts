import {
  cardDebtAt, impliedMonthlyRate, loanOutstandingAt, todayInSaoPaulo,
  type CardDebtInput, type DateOnly, type DebtsDTO, type LoanDebtInput,
} from '@fincontrol/shared';
import { toDateOnly } from '../../infra/date-mapping';
import type { Db } from '../../infra/prisma';

export type DebtSources = { cards: CardDebtInput[]; loans: LoanDebtInput[] };

/**
 * Dívidas de cartão (R5) e de empréstimo (R6) da spec do sub-projeto 4. Lê tudo de uma vez e calcula para
 * qualquer data com as funções puras de `@fincontrol/shared` — o painel usa hoje, o relatório usa o fim de cada mês.
 */
export function createDebtsReader(db: Db) {
  async function cardSources(userId: string): Promise<CardDebtInput[]> {
    // Cartões arquivados entram: ainda podem ter fatura a pagar (R16 do sub-projeto 2).
    const cards = await db.account.findMany({ where: { userId, type: 'credit_card' }, select: { id: true, initialBalance: true } });
    if (cards.length === 0) return [];
    const ids = cards.map((c) => c.id);
    // Sem limite de data: as parcelas futuras de uma compra já feita são dívida (R5).
    const rows = await db.transaction.findMany({
      where: { userId, status: 'paid', OR: [{ accountId: { in: ids } }, { destinationAccountId: { in: ids } }] },
      select: { type: true, amount: true, paidDate: true, accountId: true, destinationAccountId: true, installmentGroupId: true },
    });

    // A compra parcelada vira dívida inteira na data da 1ª parcela (a menor data do grupo).
    const groupStart = new Map<string, DateOnly>();
    for (const r of rows) {
      if (!r.installmentGroupId || !r.paidDate) continue;
      const d = toDateOnly(r.paidDate);
      const seen = groupStart.get(r.installmentGroupId);
      if (!seen || d < seen) groupStart.set(r.installmentGroupId, d);
    }

    const byCard = new Map<string, CardDebtInput>(cards.map((c) => [c.id, { initialBalance: Number(c.initialBalance), charges: [], credits: [] }]));
    for (const r of rows) {
      if (!r.paidDate) continue;
      const date = toDateOnly(r.paidDate);
      const amount = Number(r.amount);
      const own = byCard.get(r.accountId);
      if (own) {
        if (r.type === 'income') own.credits.push({ amount, date });
        else own.charges.push({ amount, startDate: (r.installmentGroupId && groupStart.get(r.installmentGroupId)) || date });
      }
      const destination = r.type === 'transfer' && r.destinationAccountId ? byCard.get(r.destinationAccountId) : undefined;
      if (destination) destination.credits.push({ amount, date });
    }
    return [...byCard.values()];
  }

  async function loanSources(userId: string): Promise<LoanDebtInput[]> {
    const loans = await db.loan.findMany({ where: { userId } });
    if (loans.length === 0) return [];
    const paid = await db.transaction.findMany({
      where: { userId, status: 'paid', loanId: { in: loans.map((l) => l.id) } },
      select: { loanId: true, paidDate: true },
    });
    return loans.map((l) => {
      const installmentAmount = Number(l.installmentAmount);
      return {
        installmentAmount,
        monthlyRate: impliedMonthlyRate(Number(l.principal), installmentAmount, l.installmentsTotal),
        installmentsTotal: l.installmentsTotal,
        installmentsPaidBefore: l.installmentsPaidBefore,
        firstDueDate: toDateOnly(l.firstDueDate),
        createdAt: todayInSaoPaulo(l.createdAt),
        paidDates: paid.filter((p) => p.loanId === l.id && p.paidDate).map((p) => toDateOnly(p.paidDate!)),
      };
    });
  }

  return {
    async load(userId: string): Promise<DebtSources> {
      const [cards, loans] = await Promise.all([cardSources(userId), loanSources(userId)]);
      return { cards, loans };
    },
  };
}

export type DebtsReader = ReturnType<typeof createDebtsReader>;

export function debtsAt(sources: DebtSources, date: DateOnly): DebtsDTO {
  const cards = sources.cards.reduce((sum, c) => sum + cardDebtAt(c, date), 0);
  const loans = sources.loans.reduce((sum, l) => sum + loanOutstandingAt(l, date), 0);
  return { cards, loans, total: cards + loans };
}
