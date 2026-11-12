import {
  endOfMonth, monthOf, todayInSaoPaulo,
  type CreateTransactionInput, type DateOnly, type ListTransactionsQuery, type Scope, type ShapeInput,
  type TransactionDTO, type TransactionPage, type TransactionStatus, type UpdateTransactionInput,
} from '@fincontrol/shared';
import { NotFoundError, UnprocessableError } from '../../http/errors';
import type { RecurrencesService } from '../recurrences/recurrences.service';
import { decodeCursor, encodeCursor } from './transactions.cursor';
import { toTransactionDTO } from './transactions.mapper';
import type { ValidateRefs } from './transactions.refs';
import type { TransactionRow, TransactionsRepository } from './transactions.repository';

export type TransactionsServiceDeps = {
  repo: TransactionsRepository;
  validateRefs: ValidateRefs;
  recurrences: RecurrencesService;
  clock: () => Date;
};

export function createTransactionsService(deps: TransactionsServiceDeps) {
  const { repo, validateRefs, recurrences } = deps;
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

  return {
    async create(userId: string, input: CreateTransactionInput): Promise<TransactionDTO> {
      await validateRefs(userId, input);
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
      await getOwned(userId, id);
      const row = await repo.update(userId, id, { status: 'paid', paidDate: resolvePaidDate('paid', paidDate) });
      return toTransactionDTO(row, today());
    },

    async unpay(userId: string, id: string): Promise<TransactionDTO> {
      await getOwned(userId, id);
      return toTransactionDTO(await repo.update(userId, id, { status: 'pending', paidDate: null }), today());
    },
  };
}

export type TransactionsService = ReturnType<typeof createTransactionsService>;
