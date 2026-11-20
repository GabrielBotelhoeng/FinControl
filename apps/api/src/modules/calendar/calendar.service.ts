import {
  addMonthsToYm, categoryPath, endOfMonth, monthOf, startOfMonth, todayInSaoPaulo,
  type CalendarDTO, type CalendarItemDTO, type DateOnly, type YearMonth,
} from '@fincontrol/shared';
import { UnprocessableError } from '../../http/errors';
import { fromDateOnly, toDateOnly } from '../../infra/date-mapping';
import type { Db } from '../../infra/prisma';
import type { AccountsRepository } from '../accounts/accounts.repository';
import type { CardsService } from '../cards/cards.service';
import type { RecurrencesService } from '../recurrences/recurrences.service';

export type CalendarServiceDeps = {
  db: Db;
  accountsRepo: AccountsRepository;
  cards: Pick<CardsService, 'invoiceOfMonth'>;
  recurrences: Pick<RecurrencesService, 'materialize'>;
  clock: () => Date;
};

/** Auditoria final (B3): 11, como o orçamento; as recorrências só existem até hoje + 366 dias (o 12º mês sairia incompleto). */
export const CALENDAR_MAX_MONTHS_AHEAD = 11;

/** Calendário de contas (sub-projeto 8, K1–K3): o que vence em cada dia do mês. */
export function createCalendarService(deps: CalendarServiceDeps) {
  return {
    async month(userId: string, month?: YearMonth): Promise<CalendarDTO> {
      const today = todayInSaoPaulo(deps.clock());
      const m = month ?? monthOf(today);
      // A leitura materializa recorrências: sem limite, navegar anos à frente gravaria lançamentos até lá (revisão final).
      if (m > addMonthsToYm(monthOf(today), CALENDAR_MAX_MONTHS_AHEAD)) {
        throw new UnprocessableError(`O calendário vai até ${CALENDAR_MAX_MONTHS_AHEAD} meses à frente.`);
      }
      const from = startOfMonth(m);
      const to = endOfMonth(m);
      // As recorrências do mês viram lançamentos antes da leitura, como em Lançamentos.
      await deps.recurrences.materialize(userId, to);

      const accounts = await deps.accountsRepo.list(userId, true);
      const cardIds = accounts.filter((a) => a.type === 'credit_card').map((c) => c.id);
      // Cartão sem dia de fechamento ou de vencimento não tem fatura: não derruba o calendário inteiro (revisão final).
      const cards = accounts.filter((a) => a.type === 'credit_card' && a.closingDay != null && a.dueDay != null);

      // K1: receitas e despesas pelo vencimento, fora de cartão (a compra no cartão aparece na fatura). Transferências ficam de fora.
      const rows = await deps.db.transaction.findMany({
        where: {
          userId, type: { in: ['income', 'expense'] }, accountId: { notIn: cardIds },
          dueDate: { gte: fromDateOnly(from), lte: fromDateOnly(to) },
        },
        select: {
          id: true, description: true, type: true, amount: true, status: true, dueDate: true,
          category: { select: { name: true, parent: { select: { name: true } } } },
        },
        orderBy: [{ dueDate: 'asc' }, { createdAt: 'asc' }],
      });

      const byDay = new Map<DateOnly, CalendarItemDTO[]>();
      const push = (date: DateOnly, item: CalendarItemDTO) => byDay.set(date, [...(byDay.get(date) ?? []), item]);
      const totals = { toPay: 0, paid: 0, toReceive: 0, received: 0 };

      for (const r of rows) {
        const date = toDateOnly(r.dueDate);
        const amount = Number(r.amount);
        const type = r.type as 'income' | 'expense';
        push(date, {
          kind: 'transaction', id: r.id, description: r.description, type, amount, status: r.status,
          // Sub-projeto 15 (U4): "Alimentação › Mercado" quando o lançamento está numa subcategoria.
          overdue: r.status === 'pending' && date < today, category: r.category ? categoryPath(r.category.name, r.category.parent?.name) : null,
        });
        if (type === 'expense') totals[r.status === 'paid' ? 'paid' : 'toPay'] += amount;
        else totals[r.status === 'paid' ? 'received' : 'toReceive'] += amount;
      }

      // K2: a fatura de cada cartão que vence no mês (o vencimento sempre cai no próprio mês da fatura, `invoiceDates`),
      // inclusive as futuras, com as parcelas já lançadas (CodeRabbit).
      const perCard = await Promise.all(cards.map(async (card) => ({ card, invoices: [await deps.cards.invoiceOfMonth(userId, card.id, m)] })));
      for (const { card, invoices } of perCard) {
        for (const inv of invoices) {
          if (inv.dueDate < from || inv.dueDate > to || inv.amount <= 0) continue;
          const remaining = Math.max(inv.amount - inv.paid, 0);
          push(inv.dueDate, {
            kind: 'invoice', cardId: card.id, cardName: card.name, month: inv.month, remaining, amount: inv.amount, status: inv.status, future: inv.future,
          });
          totals.toPay += remaining;
          totals.paid += Math.min(inv.paid, inv.amount);
        }
      }

      const days = [...byDay.entries()].sort(([a], [b]) => (a < b ? -1 : 1)).map(([date, items]) => ({ date, items }));
      return { month: m, days, totals };
    },
  };
}

export type CalendarService = ReturnType<typeof createCalendarService>;
