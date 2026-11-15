import { monthOf, startOfMonth, type YearMonth } from '@fincontrol/shared';
import { fromDateOnly, toDateOnly } from '../../infra/date-mapping';
import type { DbClient } from '../../infra/prisma';
import { toTransactionRow, type TransactionRow } from '../transactions/transactions.repository';

export function createCardsRepository(db: DbClient) {
  return {
    /**
     * `invoiceMonth` mais antigo entre as despesas pagas do cartão; base do início da lista de faturas
     * (decisão do controlador, Tarefa 7). `null` quando o cartão nunca teve compra.
     */
    async earliestPurchaseMonth(userId: string, cardAccountId: string): Promise<YearMonth | null> {
      const result = await db.transaction.aggregate({
        where: { userId, accountId: cardAccountId, type: 'expense', status: 'paid' },
        _min: { invoiceMonth: true },
      });
      const min = result._min.invoiceMonth;
      return min ? monthOf(toDateOnly(min)) : null;
    },

    /**
     * Transações de uma fatura (decisão do controlador, Tarefa 7): as despesas do cartão com esse
     * `invoiceMonth` e os pagamentos dessa fatura (transferências para o cartão com o mesmo `invoiceMonth`),
     * por data e depois por id.
     */
    async invoiceTransactions(userId: string, cardAccountId: string, invoiceMonth: YearMonth): Promise<TransactionRow[]> {
      const month = fromDateOnly(startOfMonth(invoiceMonth));
      const rows = await db.transaction.findMany({
        where: {
          userId, invoiceMonth: month, status: 'paid',
          OR: [{ accountId: cardAccountId, type: 'expense' }, { destinationAccountId: cardAccountId, type: 'transfer' }],
        },
        orderBy: [{ dueDate: 'asc' }, { id: 'asc' }],
      });
      return rows.map(toTransactionRow);
    },
  };
}

export type CardsRepository = ReturnType<typeof createCardsRepository>;
