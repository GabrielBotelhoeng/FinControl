import {
  endOfMonth, monthOf, todayInSaoPaulo,
  type CreateTransactionInput, type DateOnly, type ListTransactionsQuery, type Scope, type ShapeInput,
  type TransactionDTO, type TransactionPage, type TransactionStatus, type UpdateTransactionInput,
} from '@fincontrol/shared';
import { NotFoundError, UnprocessableError } from '../../http/errors';
import type { RecurrencesService } from '../recurrences/recurrences.service';
import { assertCardCreateRules, assertCardEditRules, assertNotCardTransaction, buildCardPurchaseRows } from './transactions.cards';
import { decodeCursor, encodeCursor } from './transactions.cursor';
import { toTransactionDTO } from './transactions.mapper';
import type { ValidateRefs } from './transactions.refs';
import type { NewTransaction, TransactionRow, TransactionsRepository } from './transactions.repository';

export type TransactionCreateResult = TransactionDTO & { installments?: TransactionDTO[] };

export type TransactionsServiceDeps = {
  repo: TransactionsRepository;
  validateRefs: ValidateRefs;
  recurrences: RecurrencesService;
  clock: () => Date;
  /** Grava as N parcelas de uma compra no cartão numa única transação do banco (decisão R10). */
  createInstallments: (userId: string, rows: NewTransaction[]) => Promise<TransactionRow[]>;
};

export function createTransactionsService(deps: TransactionsServiceDeps) {
  const { repo, validateRefs, recurrences, createInstallments } = deps;
  const today = () => todayInSaoPaulo(deps.clock());

  async function getOwned(userId: string, id: string): Promise<TransactionRow> {
    const tx = await repo.findById(userId, id);
    if (!tx) throw new NotFoundError('Lançamento');
    return tx;
  }

  function resolvePaidDate(status: TransactionStatus, paidDate: DateOnly | null | undefined): DateOnly | null {
    if (status === 'pending') return null;
    const t = today();
    const date = paidDate ?? t;
    if (date > t) throw new UnprocessableError('A data de pagamento não pode estar no futuro.');
    return date;
  }

  async function isCard(userId: string, accountId: string): Promise<boolean> {
    const info = await repo.findAccountCardInfo(userId, accountId);
    return info?.type === 'credit_card';
  }

  /** Compra no cartão (spec C1/C3/C4): sempre paga na data da compra, com fatura gravada (decisão R10). */
  async function createCardPurchase(
    userId: string,
    input: CreateTransactionInput,
    card: { closingDay: number | null; dueDay: number | null },
  ): Promise<TransactionCreateResult> {
    const { closingDay, dueDay } = card;
    // Invariante de dados: toda conta `credit_card` tem fechamento e vencimento (exigidos na criação da conta).
    if (closingDay == null || dueDay == null) throw new Error('Cartão sem fechamento ou vencimento configurado.');
    const purchaseDate = resolvePaidDate('paid', input.dueDate)!;
    const rows = buildCardPurchaseRows(input, { closingDay, dueDay }, purchaseDate);
    const created = rows.length > 1 ? await createInstallments(userId, rows) : [await repo.create(userId, rows[0]!)];
    const dto = toTransactionDTO(created[0]!, today());
    return rows.length > 1 ? { ...dto, installments: created.map((r) => toTransactionDTO(r, today())) } : dto;
  }

  return {
    async create(userId: string, input: CreateTransactionInput): Promise<TransactionCreateResult> {
      await validateRefs(userId, input);
      const origin = await repo.findAccountCardInfo(userId, input.accountId);
      const destination = input.destinationAccountId ? await repo.findAccountCardInfo(userId, input.destinationAccountId) : null;
      const originIsCard = origin?.type === 'credit_card';
      const destinationIsCard = destination?.type === 'credit_card';
      assertCardCreateRules(input, originIsCard, destinationIsCard);
      if (originIsCard) return createCardPurchase(userId, input, origin!);

      const paidDate = resolvePaidDate(input.status, input.paidDate);
      if (input.recurrence) {
        const row = await recurrences.createSeries(userId, input, input.recurrence.frequency, input.recurrence.endDate, paidDate);
        return toTransactionDTO(row, today());
      }
      const row = await repo.create(userId, {
        type: input.type,
        amount: input.amount,
        description: input.description,
        accountId: input.accountId,
        destinationAccountId: input.destinationAccountId,
        categoryId: input.categoryId,
        nature: input.nature,
        status: input.status,
        dueDate: input.dueDate,
        paidDate,
        recurrenceId: null,
        occurrenceDate: null,
        invoiceMonth: null,
        installmentNumber: null,
        installmentTotal: null,
        installmentGroupId: null,
      });
      return toTransactionDTO(row, today());
    },

    async list(userId: string, q: ListTransactionsQuery): Promise<TransactionPage> {
      await recurrences.materialize(userId, q.to ?? endOfMonth(monthOf(today())));
      const cursor = q.cursor ? decodeCursor(q.cursor) : undefined;
      const { cursor: _c, limit, ...filters } = q;
      const rows = await repo.list(userId, filters, cursor, limit + 1);
      const page = rows.slice(0, limit);
      const last = page.at(-1);
      return {
        items: page.map((r) => toTransactionDTO(r, today())),
        nextCursor: rows.length > limit && last ? encodeCursor(last) : null,
      };
    },

    async update(userId: string, id: string, input: UpdateTransactionInput, scope: Scope): Promise<TransactionDTO> {
      const current = await getOwned(userId, id);
      // Guarda de cartão (decisão R11): antes de ramificar por escopo, para também bloquear mover uma
      // recorrência comum para um cartão via scope=future.
      const targetAccountIsCard = input.accountId !== undefined ? await isCard(userId, input.accountId) : false;
      const targetDestinationIsCard = input.destinationAccountId ? await isCard(userId, input.destinationAccountId) : false;
      assertCardEditRules({
        currentIsCard: await isCard(userId, current.accountId),
        currentDueDate: current.dueDate,
        input,
        targetAccountIsCard,
        targetDestinationIsCard,
      });

      if (scope === 'future' && current.recurrenceId) {
        return toTransactionDTO(await recurrences.updateFuture(userId, current, input), today());
      }
      const merged: ShapeInput = {
        type: current.type,
        accountId: input.accountId ?? current.accountId,
        destinationAccountId: input.destinationAccountId !== undefined ? input.destinationAccountId : current.destinationAccountId,
        categoryId: input.categoryId !== undefined ? input.categoryId : current.categoryId,
        nature: input.nature !== undefined ? input.nature : current.nature,
      };
      await validateRefs(userId, merged, {
        account: input.accountId !== undefined,
        destination: input.destinationAccountId !== undefined,
        category: input.categoryId !== undefined,
      });
      const { recurrence: _recurrence, ...fields } = input;
      return toTransactionDTO(await repo.update(userId, id, fields), today());
    },

    async remove(userId: string, id: string, scope: Scope): Promise<void> {
      const current = await getOwned(userId, id);
      if (!current.recurrenceId) {
        await repo.delete(userId, id);
        return;
      }
      if (scope === 'future') await recurrences.removeFuture(userId, current);
      else await recurrences.removeSingle(userId, current);
    },

    async pay(userId: string, id: string, paidDate?: DateOnly): Promise<TransactionDTO> {
      const current = await getOwned(userId, id);
      assertNotCardTransaction(await isCard(userId, current.accountId));
      const row = await repo.update(userId, id, { status: 'paid', paidDate: resolvePaidDate('paid', paidDate) });
      return toTransactionDTO(row, today());
    },

    async unpay(userId: string, id: string): Promise<TransactionDTO> {
      const current = await getOwned(userId, id);
      assertNotCardTransaction(await isCard(userId, current.accountId));
      return toTransactionDTO(await repo.update(userId, id, { status: 'pending', paidDate: null }), today());
    },
  };
}

export type TransactionsService = ReturnType<typeof createTransactionsService>;
