import {
  addMonthsToYm, installmentDate, invoiceFor, splitInstallments,
  type CreateTransactionInput, type DateOnly, type UpdateTransactionInput,
} from '@fincontrol/shared';
import { randomUUID } from 'node:crypto';
import { UnprocessableError } from '../../http/errors';
import type { NewTransaction } from './transactions.repository';

/** Mensagens das invariantes de cartão nos caminhos existentes de lançamentos (decisão R11). */
export const CARD_RULE_MESSAGES = {
  income: 'Cartão de crédito não recebe receita.',
  transfer: 'Transferência comum não movimenta cartão de crédito. Para pagar a fatura, use "Pagar fatura".',
  recurrence: 'Lançamento de cartão de crédito não combina com recorrência.',
  installmentsOffCard: 'Parcelamento só é permitido em compras no cartão de crédito.',
  move: 'Não é possível mover um lançamento de ou para um cartão de crédito.',
  changeDate: 'Não é possível mudar a data de um lançamento de cartão de crédito.',
  alwaysPaid: 'Lançamentos de cartão são sempre pagos.',
} as const;

/**
 * Invariantes de cartão na criação (spec C2/C4, decisão R11): cartão não recebe receita nem transferência comum
 * (origem ou destino), não combina com recorrência, e parcelamento só é permitido em compra de cartão.
 */
export function assertCardCreateRules(input: CreateTransactionInput, originIsCard: boolean, destinationIsCard: boolean): void {
  if (input.type === 'transfer' && (originIsCard || destinationIsCard)) throw new UnprocessableError(CARD_RULE_MESSAGES.transfer);
  if (originIsCard && input.recurrence) throw new UnprocessableError(CARD_RULE_MESSAGES.recurrence);
  if (input.installments !== undefined && !originIsCard) throw new UnprocessableError(CARD_RULE_MESSAGES.installmentsOffCard);
  if (originIsCard && input.type === 'income') throw new UnprocessableError(CARD_RULE_MESSAGES.income);
}

/**
 * Invariantes de cartão na edição (decisão R11): não se move um lançamento para ou de um cartão (`accountId` ou
 * `destinationAccountId` realmente mudando de valor, de ou para uma conta cartão), nem se muda a data de um
 * lançamento de cartão (`dueDate` diferente da atual). Reenviar o mesmo valor — como o formulário da web sempre
 * faz para `accountId`/`dueDate` — não é uma mudança e não bloqueia. Deve ser chamada antes da ramificação de
 * escopo (`single`/`future`), para também bloquear mover uma recorrência comum para um cartão via `scope=future`.
 */
export function assertCardEditRules(opts: {
  currentAccountId: string;
  currentDestinationAccountId: string | null;
  currentIsCard: boolean;
  currentDestinationIsCard: boolean;
  currentDueDate: DateOnly;
  input: UpdateTransactionInput;
  targetAccountIsCard: boolean;
  targetDestinationIsCard: boolean;
}): void {
  const {
    currentAccountId, currentDestinationAccountId, currentIsCard, currentDestinationIsCard, currentDueDate,
    input, targetAccountIsCard, targetDestinationIsCard,
  } = opts;
  const accountChanged = input.accountId !== undefined && input.accountId !== currentAccountId;
  const destinationChanged = input.destinationAccountId !== undefined && input.destinationAccountId !== currentDestinationAccountId;
  if (accountChanged && (currentIsCard || targetAccountIsCard)) throw new UnprocessableError(CARD_RULE_MESSAGES.move);
  if (destinationChanged && (currentDestinationIsCard || targetDestinationIsCard)) throw new UnprocessableError(CARD_RULE_MESSAGES.move);
  if (currentIsCard && input.dueDate !== undefined && input.dueDate !== currentDueDate) throw new UnprocessableError(CARD_RULE_MESSAGES.changeDate);
}

/** `pay`/`unpay` não fazem sentido num lançamento de cartão: ele já nasce pago (spec C4). */
export function assertNotCardTransaction(isCard: boolean): void {
  if (isCard) throw new UnprocessableError(CARD_RULE_MESSAGES.alwaysPaid);
}

/**
 * Linhas de uma compra no cartão: 1 à vista, ou N parceladas com fatura e grupo (spec C1/C3/C5, decisão R10).
 * A parcela k grava `dueDate = paidDate = installmentDate(compra, k)`, `invoiceMonth` = fatura da 1ª + (k−1)
 * meses, e todas compartilham `installmentGroupId`. Sem `installments`, é uma única linha sem grupo.
 */
export function buildCardPurchaseRows(
  input: Pick<CreateTransactionInput, 'amount' | 'description' | 'accountId' | 'categoryId' | 'nature' | 'installments'>,
  card: { closingDay: number; dueDay: number },
  purchaseDate: DateOnly,
): NewTransaction[] {
  const n = input.installments ?? 1;
  const amounts = n === 1 ? [input.amount] : splitInstallments(input.amount, n);
  const { invoiceMonth: firstInvoiceMonth } = invoiceFor(purchaseDate, card.closingDay, card.dueDay);
  const installmentGroupId = n > 1 ? randomUUID() : null;
  return amounts.map((amount, i): NewTransaction => {
    const k = i + 1;
    const date = installmentDate(purchaseDate, k);
    return {
      type: 'expense', amount, description: input.description, accountId: input.accountId, destinationAccountId: null,
      categoryId: input.categoryId, nature: input.nature, status: 'paid', dueDate: date, paidDate: date,
      recurrenceId: null, occurrenceDate: null, invoiceMonth: addMonthsToYm(firstInvoiceMonth, k - 1),
      installmentNumber: n > 1 ? k : null, installmentTotal: n > 1 ? n : null, installmentGroupId,
    };
  });
}
