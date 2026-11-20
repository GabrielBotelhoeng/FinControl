import {
  addDays, endOfMonth, maxDate, minDate, monthOf, todayInSaoPaulo,
  type DateOnly, type Frequency, type UpdateTransactionInput,
} from '@fincontrol/shared';
import { nthOccurrence, occurrenceDates } from '../../domain/recurrence';
import { ConflictError, NotFoundError, UnprocessableError } from '../../http/errors';
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
  tags: t.tags,
});

type Repos = { repo: RecurrencesRepository; transactions: TransactionsRepository };

export type RecurrencesServiceDeps = Repos & {
  validateRefs: ValidateRefs;
  clock: () => Date;
  /**
   * Auditoria final: editar ou excluir "desta em diante" grava em vários passos; uma falha no meio deixava duas séries
   * ativas (ocorrências em dobro). Em produção roda tudo numa transação do banco, com repositórios sobre ela.
   * Sem isto (o seed da demo, que já está dentro de uma transação), usa os repositórios de sempre.
   */
  inTransaction?: <T>(fn: (scoped: Repos) => Promise<T>) => Promise<T>;
};

/**
 * Quantos períodos da série (semanas, meses ou anos) `date` está depois de `from`. Conta pelo período, não pela data
 * exata: uma paga que já veio de outra série (com a data antiga) ainda cai no mês certo (revisão final).
 */
function periodsBetween(frequency: Frequency, from: DateOnly, date: DateOnly): number {
  if (frequency === 'weekly') return Math.floor((Date.parse(date) - Date.parse(from)) / (7 * 86_400_000));
  const months = (Number(date.slice(0, 4)) - Number(from.slice(0, 4))) * 12 + Number(date.slice(5, 7)) - Number(from.slice(5, 7));
  return frequency === 'monthly' ? months : Math.floor(months / 12);
}

const brDate = (d: DateOnly) => d.split('-').reverse().join('/');

export function createRecurrencesService(deps: RecurrencesServiceDeps) {
  const { repo, transactions, validateRefs } = deps;
  const today = () => todayInSaoPaulo(deps.clock());
  const inTransaction = deps.inTransaction ?? (<T>(fn: (scoped: Repos) => Promise<T>) => fn({ repo, transactions }));

  async function getOwned(repo: RecurrencesRepository, userId: string, id: string): Promise<RecurrenceRow> {
    const rec = await repo.findById(userId, id);
    if (!rec) throw new NotFoundError('Recorrência');
    return rec;
  }

  /** Cria as ocorrências que faltam até `until` (no máximo hoje + 366 dias). É idempotente (spec 5.3). */
  function materialize(userId: string, until: DateOnly): Promise<void> {
    return materializeWith({ repo, transactions }, userId, until);
  }

  /** `onlyId`: dentro da transação de uma edição, só a série editada (as outras ficam para a próxima leitura). */
  async function materializeWith({ repo, transactions }: Repos, userId: string, until: DateOnly, onlyId?: string): Promise<void> {
    const limit = minDate(until, addDays(today(), HORIZON_DAYS));
    const recs = (await repo.listForMaterialization(userId, limit)).filter((r) => !onlyId || r.id === onlyId);
    if (recs.length === 0) return;
    const skips = await repo.skipsFor(recs.map((r) => r.id));
    const rows: NewTransaction[] = [];
    for (const rec of recs) {
      const skipped = skips.get(rec.id);
      for (const date of occurrenceDates({ frequency: rec.frequency, startDate: rec.startDate, endDate: rec.endDate, until: limit })) {
        if (skipped?.has(date)) continue;
        rows.push({
          ...templateOf(rec), status: 'pending', dueDate: date, paidDate: null, recurrenceId: rec.id, occurrenceDate: date,
          invoiceMonth: null, installmentNumber: null, installmentTotal: null, installmentGroupId: null,
        });
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
    return inTransaction(async ({ repo, transactions }) => {
      const rec = await repo.create(userId, { ...template, frequency, startDate: input.dueDate, endDate });
      return transactions.create(userId, {
        ...template, status: input.status, dueDate: input.dueDate, paidDate, recurrenceId: rec.id, occurrenceDate: input.dueDate,
        invoiceMonth: null, installmentNumber: null, installmentTotal: null, installmentGroupId: null,
      });
    });
  }

  function updateFuture(userId: string, tx: TransactionRow, input: UpdateTransactionInput): Promise<TransactionRow> {
    return inTransaction((scoped) => updateFutureWith(scoped, userId, tx, input));
  }

  /**
   * Trava a série e relê o lançamento dentro da transação: uma edição ao mesmo tempo pode ter mudado a série dele
   * (revisão final). Nesse caso, 409 para a pessoa recarregar.
   */
  async function lockFresh({ repo, transactions }: Repos, userId: string, stale: TransactionRow): Promise<{ tx: TransactionRow; rec: RecurrenceRow }> {
    if (!stale.recurrenceId) throw new NotFoundError('Recorrência');
    await repo.lock(userId, stale.recurrenceId);
    const tx = await transactions.findById(userId, stale.id);
    if (!tx) throw new NotFoundError('Lançamento');
    if (tx.recurrenceId !== stale.recurrenceId) throw new ConflictError('Este lançamento acabou de mudar. Recarregue a página e tente de novo.');
    return { tx, rec: await getOwned(repo, userId, stale.recurrenceId) };
  }

  async function updateFutureWith(scoped: Repos, userId: string, stale: TransactionRow, input: UpdateTransactionInput): Promise<TransactionRow> {
    const { repo, transactions } = scoped;
    const { tx, rec } = await lockFresh(scoped, userId, stale);
    const pivot = tx.occurrenceDate ?? tx.dueDate;
    const template: RecurrenceTemplate = {
      type: rec.type,
      amount: input.amount ?? rec.amount,
      description: input.description ?? rec.description,
      accountId: input.accountId ?? rec.accountId,
      destinationAccountId: input.destinationAccountId !== undefined ? input.destinationAccountId : rec.destinationAccountId,
      categoryId: input.categoryId !== undefined ? input.categoryId : rec.categoryId,
      nature: input.nature !== undefined ? input.nature : rec.nature,
      tags: input.tags ?? rec.tags,
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
        throw new UnprocessableError(`Já existe um lançamento pago desta recorrência em ${brDate(newStart)}. Escolha outra data.`);
      }
    }
    // M1: a série antiga termina na véspera do pivô; começar a nova antes da ocorrência anterior deixaria dois
    // lançamentos no mesmo período. Uma anterior excluída ("só esta") não ocupa nada (revisão final).
    if (reschedule) {
      const previous = await repo.lastOccurrenceBefore(userId, rec.id, pivot);
      if (previous && newStart <= previous) {
        throw new UnprocessableError(`A nova data precisa ser depois de ${brDate(previous)}, a ocorrência anterior desta recorrência.`);
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
      // M1: cada paga levada para a série nova ocupa a vaga do período dela (mesmo mês, semana ou ano, contado a
      // partir do pivô). Sem o pulo, um mês pago adiantado ganharia uma segunda ocorrência, pendente, na data nova.
      // Com a frequência trocada não há correspondência entre os períodos: nada é pulado (revisão final).
      if (frequency === rec.frequency) {
        for (const date of await repo.paidOccurrencesFrom(userId, rec.id, addDays(pivot, 1))) {
          const k = periodsBetween(frequency, pivot, date);
          if (k > 0) await repo.addSkip(created.id, nthOccurrence(frequency, newStart, k));
        }
      }
      await repo.relinkFrom(userId, rec.id, created.id, pivot);
      if (oldEnd < rec.startDate && (await repo.countTransactions(userId, rec.id)) === 0) await repo.delete(userId, rec.id);
      targetId = created.id;
    }

    if (tx.status === 'paid') {
      // A1: o pagamento que caiu no próprio vencimento acompanha a data nova (nunca para o futuro).
      const followsDue = reschedule && tx.paidDate === tx.dueDate && newStart <= today();
      await transactions.update(userId, tx.id, {
        ...template,
        ...(reschedule ? { dueDate: newStart, occurrenceDate: newStart } : {}),
        ...(followsDue ? { paidDate: newStart } : {}),
      });
    }
    // Só a série editada: materializar as outras aqui poderia travar com uma leitura ao mesmo tempo (revisão final).
    await materializeWith(scoped, userId, maxDate(endOfMonth(monthOf(newStart)), endOfMonth(monthOf(today()))), targetId);

    const result = await transactions.findByOccurrence(userId, targetId, newStart);
    if (!result) throw new NotFoundError('Lançamento');
    return result;
  }

  function removeFuture(userId: string, stale: TransactionRow): Promise<void> {
    return inTransaction(async (scoped) => {
      const { repo, transactions } = scoped;
      const { tx, rec } = await lockFresh(scoped, userId, stale);
      const pivot = tx.occurrenceDate ?? tx.dueDate;
      await transactions.delete(userId, tx.id);
      await repo.deletePendingFrom(userId, rec.id, pivot);
      const end = addDays(pivot, -1);
      if (end < rec.startDate && (await repo.countTransactions(userId, rec.id)) === 0) await repo.delete(userId, rec.id);
      else await repo.update(userId, rec.id, { endDate: end });
    });
  }

  function removeSingle(userId: string, tx: TransactionRow): Promise<void> {
    return inTransaction(async ({ repo, transactions }) => {
      await transactions.delete(userId, tx.id);
      if (tx.recurrenceId && tx.occurrenceDate) await repo.addSkip(tx.recurrenceId, tx.occurrenceDate);
    });
  }

  return { materialize, createSeries, updateFuture, removeFuture, removeSingle };
}

export type RecurrencesService = ReturnType<typeof createRecurrencesService>;
