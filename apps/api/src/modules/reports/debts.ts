import {
  addMonthsToYm, cardDebtAt, dateInMonth, debtBalanceAt, impliedMonthlyRate, monthOf, loanOutstandingAt, todayInSaoPaulo,
  type CardDebtInput, type DateOnly, type DebtLedger, type DebtsDTO, type LoanDebtInput,
} from '@fincontrol/shared';
import { toDateOnly } from '../../infra/date-mapping';
import type { Db } from '../../infra/prisma';
import { createDebtsRepository, ledgerOf } from '../debts/debts.repository';

export type DebtSources = { cards: CardDebtInput[]; loans: LoanDebtInput[]; others: DebtLedger[] };

/**
 * Dívidas de cartão (R5) e de empréstimo (R6) da spec do sub-projeto 4, e com credores (V11 do sub-projeto 6). Lê tudo de uma vez e calcula para
 * qualquer data com as funções puras de `@fincontrol/shared` — o painel usa hoje, o relatório usa o fim de cada mês.
 */
export function createDebtsReader(db: Db) {
  const debtsRepo = createDebtsRepository(db);

  async function cardSources(userId: string): Promise<CardDebtInput[]> {
    // Cartões arquivados entram: ainda podem ter fatura a pagar (R16 do sub-projeto 2).
    const cards = await db.account.findMany({ where: { userId, type: 'credit_card' }, select: { id: true, initialBalance: true } });
    if (cards.length === 0) return [];
    const ids = cards.map((c) => c.id);
    // Sem limite de data: as parcelas futuras de uma compra já feita são dívida (R5).
    const rows = await db.transaction.findMany({
      where: { userId, status: 'paid', OR: [{ accountId: { in: ids } }, { destinationAccountId: { in: ids } }] },
      select: { type: true, amount: true, paidDate: true, accountId: true, destinationAccountId: true, installmentGroupId: true, installmentNumber: true },
    });

    // A compra parcelada vira dívida inteira na data da compra. Ela sai de cada parcela (a k-ésima vence k−1 meses
    // depois, `installmentDate`), para não andar para a frente quando a pessoa exclui a 1ª parcela. Fica a maior:
    // em mês curto o dia da parcela é cortado (31 → 30), o que só pode puxar a data reconstruída para trás.
    const groupStart = new Map<string, DateOnly>();
    for (const r of rows) {
      if (!r.installmentGroupId || !r.paidDate) continue;
      const paid = toDateOnly(r.paidDate);
      const d = dateInMonth(addMonthsToYm(monthOf(paid), -((r.installmentNumber ?? 1) - 1)), Number(paid.slice(8, 10)));
      const seen = groupStart.get(r.installmentGroupId);
      if (!seen || d > seen) groupStart.set(r.installmentGroupId, d);
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
      const [cards, loans, others] = await Promise.all([cardSources(userId), loanSources(userId), debtsRepo.load(userId)]);
      return { cards, loans, others: others.map(ledgerOf) };
    },
  };
}

export type DebtsReader = ReturnType<typeof createDebtsReader>;

export function debtsAt(sources: DebtSources, date: DateOnly): DebtsDTO {
  const cards = sources.cards.reduce((sum, c) => sum + cardDebtAt(c, date), 0);
  const loans = sources.loans.reduce((sum, l) => sum + loanOutstandingAt(l, date), 0);
  // Dívidas com credores (sub-projeto 6, V11): o mesmo saldo da página da dívida.
  const others = sources.others.reduce((sum, d) => sum + debtBalanceAt(d, date), 0);
  return { cards, loans, others, total: cards + loans + others };
}
