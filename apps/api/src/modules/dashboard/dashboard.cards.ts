import type { UpcomingInvoiceDTO, YearMonth } from '@fincontrol/shared';
import type { AccountsRepository } from '../accounts/accounts.repository';
import type { CardsService } from '../cards/cards.service';

export type CardDebtDeps = {
  accountsRepo: AccountsRepository;
  cards: CardsService;
  /** `dashboard.repository.ts`'s `installmentTotalsByAccount`, injetada para esta função não depender do repositório inteiro. */
  installmentTotalsByAccount: (userId: string, month: YearMonth) => Promise<Map<string, number>>;
};

export type CardDebt = {
  /** Itens de fatura para "A pagar" (decisão R16): `closed` ou `overdue`, restante > 0, cartão arquivado inclusive. */
  items: UpcomingInvoiceDTO[];
  /** Quantas faturas entraram em `items` (soma a `pendingCount`) e quantas delas estão vencidas (soma a `overdueCount`). */
  pendingCount: number;
  overdueCount: number;
  /** Comprometimento de renda do mês (decisão R15), já sem contar a mesma fatura duas vezes. */
  debtPayments: number;
};

/**
 * Dívida de cartão para o painel (Tarefa 8). Por cartão do usuário (inclusive arquivado), olha as faturas via
 * `cards.listInvoices` — que já reaproveita `invoiceDates`/`invoiceStatus`/`invoiceTotalsByMonth` (Tarefas 1/7);
 * a situação da fatura nunca é recalculada de outro jeito aqui. `debtPayments` soma por cartão e por fatura
 * (decisão R15): fatura vencida conta o restante (valor − pago, mínimo 0); a fatura do mês corrente que NÃO
 * está vencida conta só as parcelas (`installmentTotal >= 2`) daquele mês — pela fórmula literal, a parcela de
 * uma fatura do mês já vencida entraria duas vezes.
 */
export async function cardDebt(deps: CardDebtDeps, userId: string, current: YearMonth): Promise<CardDebt> {
  const [accounts, installmentTotals] = await Promise.all([
    deps.accountsRepo.list(userId, true),
    deps.installmentTotalsByAccount(userId, current),
  ]);
  const cardAccounts = accounts.filter((a) => a.type === 'credit_card');
  const invoicesByCard = await Promise.all(cardAccounts.map((c) => deps.cards.listInvoices(userId, c.id)));

  const items: UpcomingInvoiceDTO[] = [];
  let pendingCount = 0;
  let overdueCount = 0;
  let overdueRemaining = 0;
  let installmentContribution = 0;

  cardAccounts.forEach((card, i) => {
    let currentMonthOverdue = false;
    for (const inv of invoicesByCard[i]!) {
      if (inv.status !== 'closed' && inv.status !== 'overdue') continue;
      const remaining = Math.max(inv.amount - inv.paid, 0);
      if (remaining <= 0) continue;

      pendingCount += 1;
      items.push({ kind: 'invoice', cardId: card.id, cardName: card.name, month: inv.month, dueDate: inv.dueDate, remaining });

      if (inv.status === 'overdue') {
        overdueCount += 1;
        overdueRemaining += remaining;
        if (inv.month === current) currentMonthOverdue = true;
      }
    }
    if (!currentMonthOverdue) installmentContribution += installmentTotals.get(card.id) ?? 0;
  });

  return { items, pendingCount, overdueCount, debtPayments: overdueRemaining + installmentContribution };
}
