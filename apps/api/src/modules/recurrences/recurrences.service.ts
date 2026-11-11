import {
  addDays, endOfMonth, maxDate, minDate, monthOf, todayInSaoPaulo,
  type DateOnly, type Frequency, type UpdateTransactionInput,
} from '@fincontrol/shared';
import { occurrenceDates } from '../../domain/recurrence';
import { NotFoundError, UnprocessableError } from '../../http/errors';
import type { ValidateRefs } from '../transactions/transactions.refs';
import type { NewTransaction, TransactionRow, TransactionsRepository } from '../transactions/transactions.repository';
import type { RecurrenceRow, RecurrencesRepository, RecurrenceTemplate } from './recurrences.repository';

const HORIZON_DAYS = 366;

const templateOf = (t: RecurrenceTemplate): RecurrenceTemplate => ({
  type: t.type,
  amount: t.amount,
  description: t.description,
  accountId: t.accountId,
  destinationAccountId: t.destinationAccountId,
  categoryId: t.categoryId,
  nature: t.nature,
});

export type RecurrencesServiceDeps = {
  repo: RecurrencesRepository;
  transactions: TransactionsRepository;
  validateRefs: ValidateRefs;
  clock: () => Date;
};

export function createRecurrencesService(deps: RecurrencesServiceDeps) {
  const { repo, transactions, validateRefs } = deps;
  const today = () => todayInSaoPaulo(deps.clock());

  async function getOwned(userId: string, id: string): Promise<RecurrenceRow> {
    const rec = await repo.findById(userId, id);
    if (!rec) throw new NotFoundError('Recorrência');
    return rec;
  }

  /** Cria as ocorrências que faltam até `until` (no máximo hoje + 366 dias). É idempotente (spec 5.3). */
  async function materialize(userId: string, until: DateOnly): Promise<void> {
    const limit = minDate(until, addDays(today(), HORIZON_DAYS));
    const recs = await repo.listForMaterialization(userId, limit);
    if (recs.length === 0) return;
    const skips = await repo.skipsFor(recs.map((r) => r.id));
    const rows: NewTransaction[] = [];
    for (const rec of recs) {
      const skipped = skips.get(rec.id);
      for (const date of occurrenceDates({ frequency: rec.frequency, startDate: rec.startDate, endDate: rec.endDate, until: limit })) {
        if (skipped?.has(date)) continue;
        rows.push({ ...templateOf(rec), status: 'pending', dueDate: date, paidDate: null, recurrenceId: rec.id, occurrenceDate: date });
      }
    }
    await transactions.insertMany(userId, rows);
  }

  async function createSeries(
    userId: string,
    input: RecurrenceTemplate & { status: 'pending' | 'paid'; dueDate: DateOnly },
    frequency: Frequency,
    endDate: DateOnly | null,
    paidDate: DateOnly | null,
  ): Promise<TransactionRow> {
    const template = templateOf(input);
    const rec = await repo.create(userId, { ...template, frequency, startDate: input.dueDate, endDate });
    return transactions.create(userId, {
      ...template, status: input.status, dueDate: input.dueDate, paidDate, recurrenceId: rec.id, occurrenceDate: input.dueDate,
    });
  }

  async function updateFuture(userId: string, tx: TransactionRow, input: UpdateTransactionInput): Promise<TransactionRow> {
    if (!tx.recurrenceId) throw new NotFoundError('Recorrência');
    const rec = await getOwned(userId, tx.recurrenceId);
    const pivot = tx.occurrenceDate ?? tx.dueDate;
    const template: RecurrenceTemplate = {
      type: rec.type,
      amount: input.amount ?? rec.amount,
      description: input.description ?? rec.description,
      accountId: input.accountId ?? rec.accountId,
      destinationAccountId: input.destinationAccountId !== undefined ? input.destinationAccountId : rec.destinationAccountId,
      categoryId: input.categoryId !== undefined ? input.categoryId : rec.categoryId,
      nature: input.nature !== undefined ? input.nature : rec.nature,
    };
    await validateRefs(userId, template, {
      account: input.accountId !== undefined,
      destination: input.destinationAccountId !== undefined,
      category: input.categoryId !== undefined,
    });

    const frequency = input.recurrence?.frequency ?? rec.frequency;
    const endDate = input.recurrence ? input.recurrence.endDate : rec.endDate;
    const newStart = input.dueDate ?? pivot;
    const reschedule = newStart !== pivot || frequency !== rec.frequency;
    if (endDate !== null && endDate < newStart) {
      throw new UnprocessableError('O fim da recorrência não pode ser anterior a este lançamento.');
    }
    // As pagas a partir do pivô vão para a nova série com a data original; mover esta paga para cima de
    // outra paga violaria (recorrência, data da ocorrência). Recusa antes de qualquer escrita.
    if (tx.status === 'paid' && reschedule && newStart > pivot) {
      const taken = await transactions.findByOccurrence(userId, rec.id, newStart);
      if (taken && taken.id !== tx.id && taken.status === 'paid') {
        const day = newStart.split('-').reverse().join('/');
        throw new UnprocessableError(`Já existe um lançamento pago desta recorrência em ${day}. Escolha outra data.`);
      }
    }

    let targetId = rec.id;
    if (!reschedule) {
      // Mesmo calendário: atualiza o template e regenera as pendentes a partir daqui.
      await repo.update(userId, rec.id, { ...template, endDate });
      await repo.deletePendingFrom(userId, rec.id, pivot);
    } else {
      // Novo calendário: encerra a série antiga antes do pivô e abre uma nova.
      const created = await repo.create(userId, { ...template, frequency, startDate: newStart, endDate });
      const oldEnd = addDays(pivot, -1);
      await repo.update(userId, rec.id, { endDate: oldEnd });
      await repo.deletePendingFrom(userId, rec.id, pivot);
      await repo.relinkFrom(userId, rec.id, created.id, pivot);
      if (oldEnd < rec.startDate && (await repo.countTransactions(userId, rec.id)) === 0) await repo.delete(userId, rec.id);
      targetId = created.id;
    }

    if (tx.status === 'paid') {
      await transactions.update(userId, tx.id, { ...template, ...(reschedule ? { dueDate: newStart, occurrenceDate: newStart } : {}) });
    }
    await materialize(userId, maxDate(endOfMonth(monthOf(newStart)), endOfMonth(monthOf(today()))));

    const result = await transactions.findByOccurrence(userId, targetId, newStart);
    if (!result) throw new NotFoundError('Lançamento');
    return result;
  }

  async function removeFuture(userId: string, tx: TransactionRow): Promise<void> {
    if (!tx.recurrenceId) throw new NotFoundError('Recorrência');
    const rec = await getOwned(userId, tx.recurrenceId);
    const pivot = tx.occurrenceDate ?? tx.dueDate;
    await transactions.delete(userId, tx.id);
    await repo.deletePendingFrom(userId, rec.id, pivot);
    const end = addDays(pivot, -1);
    if (end < rec.startDate && (await repo.countTransactions(userId, rec.id)) === 0) await repo.delete(userId, rec.id);
    else await repo.update(userId, rec.id, { endDate: end });
  }

  async function removeSingle(userId: string, tx: TransactionRow): Promise<void> {
    await transactions.delete(userId, tx.id);
    if (tx.recurrenceId && tx.occurrenceDate) await repo.addSkip(tx.recurrenceId, tx.occurrenceDate);
  }

  return { materialize, createSeries, updateFuture, removeFuture, removeSingle };
}

export type RecurrencesService = ReturnType<typeof createRecurrencesService>;
