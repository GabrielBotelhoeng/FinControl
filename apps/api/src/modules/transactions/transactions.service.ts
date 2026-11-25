import {
  endOfMonth, monthOf, todayInSaoPaulo,
  type CreateTransactionInput, type DateOnly, type ListTransactionsQuery, type Scope, type ShapeInput,
  type TransactionDTO, type TransactionPage, type TransactionStatus, type UpdateTransactionInput,
} from '@fincontrol/shared';
import { NotFoundError, UnprocessableError } from '../../http/errors';

/** Parcelas de empréstimo nos caminhos de lançamentos: o contrato é gerido pela página do empréstimo. */
export const LOAN_INSTALLMENT_MESSAGES = {
  remove: 'Esta é uma parcela de empréstimo. Para apagá-la, exclua o empréstimo na página Empréstimos.',
  amount: 'O valor de uma parcela de empréstimo vem do contrato. Para mudar, exclua e cadastre o empréstimo de novo.',
} as const;

/** Parcelas de acordo de dívida (sub-projeto 6, V8): mesma regra das de empréstimo. Pagamentos avulsos ficam livres. */
export const DEBT_INSTALLMENT_MESSAGES = {
  remove: 'Esta é uma parcela de acordo de dívida. Para apagá-la, cancele o acordo na página Dívidas.',
  amount: 'O valor de uma parcela de acordo vem do acordo. Para mudar, cancele o acordo e feche outro na página Dívidas.',
  /** O valor atualizado (ou o acordo) da dívida já contou este pagamento: mexer nele agora contaria duas vezes (V3). */
  frozen: 'Este pagamento já está incluído numa atualização de valor ou num acordo posterior da dívida e não pode ser desmarcado nem pago de novo.',
  beforeAnchor: 'A data do pagamento não pode ser anterior à última atualização do valor da dívida.',
} as const;
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
  /**
   * Pagar ou desmarcar um lançamento de dívida (sub-projeto 6, V3) com a dívida travada: recebe a última âncora e o
   * repositório da transação. A âncora trava os pagamentos que ela já contou; a trava evita correr com o cancelamento.
   */
  withDebtLock: <T>(
    userId: string,
    debtId: string,
    fn: (anchor: { date: DateOnly; recordedAt: Date } | null, repo: Pick<TransactionsRepository, 'findById' | 'update'>) => Promise<T>,
  ) => Promise<T>;
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

  /**
   * Sem data de pagamento, `fallback` decide: na criação é o vencimento (auditoria final, A1: "Já está pago"
   * num lançamento antigo conta no mês dele, não no de hoje), limitado a hoje; no "pagar" é hoje.
   */
  function resolvePaidDate(status: TransactionStatus, paidDate: DateOnly | null | undefined, fallback?: DateOnly): DateOnly | null {
    if (status === 'pending') return null;
    const t = today();
    const date = paidDate ?? (fallback && fallback < t ? fallback : t);
    if (date > t) throw new UnprocessableError('A data de pagamento não pode estar no futuro.');
    return date;
  }

  /** V3: um lançamento registrado antes da última âncora já está no valor dela; pagar ou desmarcar contaria duas vezes. */
  /** Muda a situação; num lançamento de dívida, só depois de conferir a última âncora com a dívida travada. */
  async function setStatus(userId: string, current: TransactionRow, patch: { status: TransactionStatus; paidDate: DateOnly | null }) {
    if (!current.debtId) return repo.update(userId, current.id, patch);
    return deps.withDebtLock(userId, current.debtId, async (anchor, txRepo) => {
      // Relido com a trava (E-002): um cancelamento de acordo que terminou enquanto este esperava apagou a parcela.
      const fresh = await txRepo.findById(userId, current.id);
      if (!fresh) throw new NotFoundError('Lançamento');
      if (anchor) {
        if (fresh.createdAt <= anchor.recordedAt) throw new UnprocessableError(DEBT_INSTALLMENT_MESSAGES.frozen);
        if (patch.paidDate && patch.paidDate < anchor.date) throw new UnprocessableError(DEBT_INSTALLMENT_MESSAGES.beforeAnchor);
      }
      return txRepo.update(userId, current.id, patch);
    });
  }

  /** V8: o valor de uma parcela de acordo vem do acordo. Reenviar o mesmo valor (o formulário sempre envia) é permitido. */
  function assertDebtInstallmentAmount(row: TransactionRow, amount: number | undefined): void {
    if (row.debtId && row.installmentNumber !== null && amount !== undefined && amount !== row.amount) {
      throw new UnprocessableError(DEBT_INSTALLMENT_MESSAGES.amount);
    }
  }

  /** Grava a edição; num lançamento de dívida, com a dívida travada e o lançamento relido (E-003). */
  async function writeUpdate(userId: string, current: TransactionRow, fields: Partial<NewTransaction>, amount: number | undefined) {
    if (!current.debtId) return repo.update(userId, current.id, fields);
    return deps.withDebtLock(userId, current.debtId, async (_anchor, txRepo) => {
      // Um cancelamento de acordo que terminou enquanto este esperava apagou a parcela: 404, não erro interno.
      const fresh = await txRepo.findById(userId, current.id);
      if (!fresh) throw new NotFoundError('Lançamento');
      assertDebtInstallmentAmount(fresh, amount);
      return txRepo.update(userId, current.id, fields);
    });
  }

  /**
   * A1: num pago cujo pagamento caiu no próprio vencimento, mudar o vencimento leva o pagamento junto (senão ele
   * seguiria contando no mês antigo). Pagamento em outra data é escolha da pessoa e fica; nunca vai para o futuro.
   * Lançamentos de cartão e de dívida ficam de fora: lá a data de pagamento tem regra própria.
   */
  function followPaidDate(current: TransactionRow, dueDate: DateOnly | undefined): { paidDate?: DateOnly } {
    if (!dueDate || dueDate === current.dueDate || current.status !== 'paid') return {};
    if (current.paidDate !== current.dueDate || current.invoiceMonth || current.debtId || dueDate > today()) return {};
    return { paidDate: dueDate };
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

      const paidDate = resolvePaidDate(input.status, input.paidDate, input.dueDate);
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
        tags: input.tags,
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
      // Parcela de empréstimo (revisão da Parte B): o valor vem do contrato; mudá-lo aqui faria o saldo devedor
      // e o comprometimento discordarem. Reenviar o mesmo valor (o formulário sempre envia) é permitido.
      if (current.loanId && input.amount !== undefined && input.amount !== current.amount) {
        throw new UnprocessableError(LOAN_INSTALLMENT_MESSAGES.amount);
      }
      // Conferido de novo dentro da trava, com o lançamento relido (writeUpdate).
      assertDebtInstallmentAmount(current, input.amount);
      // Guarda de cartão (decisão R11): antes de ramificar por escopo, para também bloquear mover uma
      // recorrência comum para um cartão via scope=future. Só bloqueia accountId/destinationAccountId que
      // realmente mudam de valor — reenviar o mesmo valor (como o formulário da web sempre faz) é permitido.
      const targetAccountIsCard = input.accountId !== undefined ? await isCard(userId, input.accountId) : false;
      const targetDestinationIsCard = input.destinationAccountId ? await isCard(userId, input.destinationAccountId) : false;
      assertCardEditRules({
        currentAccountId: current.accountId,
        currentDestinationAccountId: current.destinationAccountId,
        currentIsCard: await isCard(userId, current.accountId),
        currentDestinationIsCard: current.destinationAccountId ? await isCard(userId, current.destinationAccountId) : false,
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
      const updated = await writeUpdate(userId, current, fields, input.amount);
      const follow = followPaidDate(current, input.dueDate);
      // Condicional: um pagamento registrado ao mesmo tempo (outra data) não é sobrescrito (CodeRabbit).
      if (follow.paidDate && current.paidDate) {
        return toTransactionDTO((await repo.movePaidDate(userId, id, current.paidDate, follow.paidDate)) ?? updated, today());
      }
      return toTransactionDTO(updated, today());
    },

    async remove(userId: string, id: string, scope: Scope): Promise<void> {
      const current = await getOwned(userId, id);
      // Sem esta guarda, o empréstimo ficaria "47 de 48" para sempre, sem como religar a parcela (revisão da Parte B).
      if (current.loanId) throw new UnprocessableError(LOAN_INSTALLMENT_MESSAGES.remove);
      if (current.debtId && current.installmentNumber !== null) throw new UnprocessableError(DEBT_INSTALLMENT_MESSAGES.remove);
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
      const row = await setStatus(userId, current, { status: 'paid', paidDate: resolvePaidDate('paid', paidDate) });
      return toTransactionDTO(row, today());
    },

    async unpay(userId: string, id: string): Promise<TransactionDTO> {
      const current = await getOwned(userId, id);
      assertNotCardTransaction(await isCard(userId, current.accountId));
      return toTransactionDTO(await setStatus(userId, current, { status: 'pending', paidDate: null }), today());
    },
  };
}

export type TransactionsService = ReturnType<typeof createTransactionsService>;
