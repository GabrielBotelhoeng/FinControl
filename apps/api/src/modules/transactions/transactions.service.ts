import {
  todayInSaoPaulo,
  type CreateTransactionInput, type DateOnly, type ListTransactionsQuery, type ShapeInput,
  type TransactionDTO, type TransactionPage, type TransactionStatus, type UpdateTransactionInput,
} from '@fincontrol/shared';
import { NotFoundError, UnprocessableError } from '../../http/errors';
import { decodeCursor, encodeCursor } from './transactions.cursor';
import { toTransactionDTO } from './transactions.mapper';
import type { ValidateRefs } from './transactions.refs';
import type { TransactionRow, TransactionsRepository } from './transactions.repository';

export type TransactionsServiceDeps = {
  repo: TransactionsRepository;
  validateRefs: ValidateRefs;
  clock: () => Date;
};

export function createTransactionsService(deps: TransactionsServiceDeps) {
  const { repo, validateRefs } = deps;
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
        paidDate: resolvePaidDate(input.status, input.paidDate),
        recurrenceId: null,
        occurrenceDate: null,
      });
      return toTransactionDTO(row, today());
    },

    async list(userId: string, q: ListTransactionsQuery): Promise<TransactionPage> {
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

    async update(userId: string, id: string, input: UpdateTransactionInput): Promise<TransactionDTO> {
      const current = await getOwned(userId, id);
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

    async remove(userId: string, id: string): Promise<void> {
      await getOwned(userId, id);
      await repo.delete(userId, id);
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
