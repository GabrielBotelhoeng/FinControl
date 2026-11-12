import {
  addMonthsToYm, invoiceDates, invoiceFor, invoiceStatus, todayInSaoPaulo,
  type InvoiceDTO, type PayInvoiceInput, type TransactionDTO, type YearMonth,
} from '@fincontrol/shared';
import { NotFoundError, UnprocessableError } from '../../http/errors';
import type { AccountsRepository } from '../accounts/accounts.repository';
import type { AccountsService } from '../accounts/accounts.service';
import { toTransactionDTO } from '../transactions/transactions.mapper';
import type { NewTransaction, TransactionsRepository } from '../transactions/transactions.repository';
import type { CardsRepository } from './cards.repository';

export type InvoiceDetailDTO = InvoiceDTO & { transactions: TransactionDTO[] };

export type CardsServiceDeps = {
  repo: CardsRepository;
  accountsRepo: AccountsRepository;
  accounts: AccountsService;
  transactionsRepo: TransactionsRepository;
  clock: () => Date;
};

const MONTH_ABBREV = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'] as const;

/** "2026-11" → "nov/2026", para identificar a fatura na descrição do pagamento (decisão do controlador). */
function invoiceLabel(month: YearMonth): string {
  const [year, m] = month.split('-');
  return `${MONTH_ABBREV[Number(m) - 1]}/${year}`;
}

export function createCardsService(deps: CardsServiceDeps) {
  const { repo, accountsRepo, accounts, transactionsRepo } = deps;
  const today = () => todayInSaoPaulo(deps.clock());

  /**
   * Cartão do usuário (spec C2, decisão R14): `:id` inexistente, de outro usuário ou de conta comum → 404.
   * Cartão arquivado é permitido (ele segue em "a pagar" até a quitação) — por isso não checa `archivedAt`.
   */
  async function getOwnedCard(userId: string, id: string): Promise<{ closingDay: number; dueDay: number }> {
    const account = await accountsRepo.findById(userId, id);
    if (!account || account.type !== 'credit_card' || account.closingDay == null || account.dueDay == null) {
      throw new NotFoundError('Cartão');
    }
    return { closingDay: account.closingDay, dueDay: account.dueDay };
  }

  function toInvoiceDTO(card: { closingDay: number; dueDay: number }, month: YearMonth, totals: { amount: number; paid: number }): InvoiceDTO {
    const { closingDate, dueDate } = invoiceDates(month, card.closingDay, card.dueDay);
    return {
      month, closingDate, dueDate, amount: totals.amount, paid: totals.paid,
      status: invoiceStatus({ today: today(), closingDate, dueDate, amount: totals.amount, paid: totals.paid }),
    };
  }

  return {
    /**
     * Do `invoiceMonth` mais antigo com despesa até a fatura aberta; sem compras, só a aberta (valor 0).
     * `from`/`to` recortam o intervalo (nunca o estendem). Ordem: da mais recente para a mais antiga, a
     * aberta primeiro (decisão do controlador).
     */
    async listInvoices(userId: string, cardId: string, from?: YearMonth, to?: YearMonth): Promise<InvoiceDTO[]> {
      const card = await getOwnedCard(userId, cardId);
      const open = invoiceFor(today(), card.closingDay, card.dueDay).invoiceMonth;
      const earliest = (await repo.earliestPurchaseMonth(userId, cardId)) ?? open;
      const start = from && from > earliest ? from : earliest;
      const end = to && to < open ? to : open;
      if (start > end) return [];

      const totalsByMonth = await accountsRepo.invoiceTotalsByMonth(userId, cardId, start, end);
      const months: YearMonth[] = [];
      for (let m = start; m <= end; m = addMonthsToYm(m, 1)) months.push(m);
      return months.map((m) => toInvoiceDTO(card, m, totalsByMonth.get(m) ?? { amount: 0, paid: 0 })).reverse();
    },

    /** `transactions`: despesas do cartão com esse mês e os pagamentos dessa fatura (decisão do controlador). */
    async getInvoice(userId: string, cardId: string, month: YearMonth): Promise<InvoiceDetailDTO> {
      const card = await getOwnedCard(userId, cardId);
      const [totals, rows] = await Promise.all([
        accountsRepo.invoiceTotals(userId, cardId, month),
        repo.invoiceTransactions(userId, cardId, month),
      ]);
      return { ...toInvoiceDTO(card, month, totals), transactions: rows.map((r) => toTransactionDTO(r, today())) };
    },

    /**
     * Transferência paga da conta informada para o cartão, com `dueDate = paidDate` = a data enviada e
     * `invoiceMonth = month` (decisão do controlador). Único caminho de transferência para cartão desde a
     * Tarefa 6 (decisão R11) — por isso grava direto no repositório de lançamentos, não pelo service.
     */
    async payInvoice(userId: string, cardId: string, month: YearMonth, input: PayInvoiceInput): Promise<TransactionDTO> {
      await getOwnedCard(userId, cardId);
      await accounts.assertPayer(userId, input.accountId);
      const t = today();
      if (input.paidDate > t) throw new UnprocessableError('A data de pagamento não pode estar no futuro.');

      const row: NewTransaction = {
        type: 'transfer',
        amount: input.amount,
        description: `Pagamento da fatura ${invoiceLabel(month)}`,
        accountId: input.accountId,
        destinationAccountId: cardId,
        categoryId: null,
        nature: null,
        status: 'paid',
        dueDate: input.paidDate,
        paidDate: input.paidDate,
        recurrenceId: null,
        occurrenceDate: null,
        invoiceMonth: month,
        installmentNumber: null,
        installmentTotal: null,
        installmentGroupId: null,
      };
      return toTransactionDTO(await transactionsRepo.create(userId, row), t);
    },
  };
}

export type CardsService = ReturnType<typeof createCardsService>;
