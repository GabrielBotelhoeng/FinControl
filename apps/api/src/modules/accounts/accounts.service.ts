import {
  accountCardIssues, addMonthsToYm, invoiceDates, invoiceFor, todayInSaoPaulo,
  type AccountDTO, type CreateAccountInput, type UpdateAccountInput,
} from '@fincontrol/shared';
import { computeBalance, ZERO_FLOWS, type AccountFlows } from '../../domain/balance';
import { ConflictError, NotFoundError, UnprocessableError } from '../../http/errors';
import type { AccountRow, AccountsRepository } from './accounts.repository';

export type AccountsServiceDeps = { repo: AccountsRepository; clock: () => Date };

export function createAccountsService(deps: AccountsServiceDeps) {
  const { repo } = deps;
  const today = () => todayInSaoPaulo(deps.clock());

  async function getOwned(userId: string, id: string): Promise<AccountRow> {
    const account = await repo.findById(userId, id);
    if (!account) throw new NotFoundError('Conta');
    return account;
  }

  async function assertNameFree(userId: string, name: string, exceptId?: string): Promise<void> {
    if (await repo.findActiveByName(userId, name, exceptId)) throw new ConflictError('Já existe uma conta ativa com esse nome.');
  }

  /** Conta pagadora: do próprio usuário (404 se não encontrada), não arquivada e que não é cartão (spec C2). */
  async function assertPayer(userId: string, paymentAccountId: string): Promise<void> {
    const payer = await getOwned(userId, paymentAccountId);
    if (payer.archivedAt) throw new UnprocessableError('A conta pagadora não pode estar arquivada.');
    if (payer.type === 'credit_card') throw new UnprocessableError('A conta pagadora não pode ser um cartão de crédito.');
  }

  /**
   * Próxima fatura com vencimento ≥ hoje e saldo a pagar (valor − pago > 0), olhando só até a fatura aberta
   * (decisão R8). Por construção de `invoiceDates`/`invoiceFor`, o vencimento da fatura aberta é sempre ≥ hoje;
   * a fatura anterior só entra na disputa enquanto ainda não tiver vencido.
   */
  async function nextDueFor(
    userId: string,
    card: { id: string; closingDay: number; dueDay: number },
    todayStr: string,
    open: { invoiceMonth: string; dueDate: string },
    openTotals: { amount: number; paid: number },
  ): Promise<{ date: string; amount: number } | null> {
    const prevMonth = addMonthsToYm(open.invoiceMonth, -1);
    const prevDueDate = invoiceDates(prevMonth, card.closingDay, card.dueDay).dueDate;
    if (prevDueDate >= todayStr) {
      const prev = await repo.invoiceTotals(userId, card.id, prevMonth);
      const remaining = prev.amount - prev.paid;
      if (remaining > 0) return { date: prevDueDate, amount: remaining };
    }
    const remaining = openTotals.amount - openTotals.paid;
    return remaining > 0 ? { date: open.dueDate, amount: remaining } : null;
  }

  /** `card` do DTO: só em `credit_card` (spec C2/C6, decisão R8). */
  async function cardInfo(userId: string, a: AccountRow, balance: number): Promise<AccountDTO['card']> {
    if (a.type !== 'credit_card' || a.creditLimit == null || a.closingDay == null || a.dueDay == null) return null;
    const { closingDay, dueDay, creditLimit } = a;
    const todayStr = today();
    const open = invoiceFor(todayStr, closingDay, dueDay);
    const openTotals = await repo.invoiceTotals(userId, a.id, open.invoiceMonth);
    const openInvoice = openTotals.amount > 0 ? { month: open.invoiceMonth, amount: openTotals.amount } : null;
    const nextDue = await nextDueFor(userId, { id: a.id, closingDay, dueDay }, todayStr, open, openTotals);
    return { limitAvailable: creditLimit + balance, openInvoice, nextDue };
  }

  async function toDTO(userId: string, a: AccountRow, flows: AccountFlows = ZERO_FLOWS): Promise<AccountDTO> {
    const balance = computeBalance(a.initialBalance, flows);
    return {
      id: a.id,
      name: a.name,
      type: a.type,
      color: a.color,
      initialBalance: a.initialBalance,
      balance,
      archivedAt: a.archivedAt?.toISOString() ?? null,
      createdAt: a.createdAt.toISOString(),
      creditLimit: a.creditLimit,
      closingDay: a.closingDay,
      dueDay: a.dueDay,
      paymentAccountId: a.paymentAccountId,
      card: await cardInfo(userId, a, balance),
    };
  }

  async function withBalance(userId: string, account: AccountRow): Promise<AccountDTO> {
    const flows = await repo.flowsByAccount(userId);
    return toDTO(userId, account, flows.get(account.id));
  }

  return {
    async list(userId: string, includeArchived: boolean): Promise<AccountDTO[]> {
      const [rows, flows] = await Promise.all([repo.list(userId, includeArchived), repo.flowsByAccount(userId)]);
      return Promise.all(rows.map((a) => toDTO(userId, a, flows.get(a.id))));
    },

    async create(userId: string, input: CreateAccountInput): Promise<AccountDTO> {
      await assertNameFree(userId, input.name);
      if (input.type === 'credit_card') {
        if (input.initialBalance !== 0) throw new UnprocessableError('O saldo inicial do cartão deve ser zero.');
        const paymentAccountId = input.paymentAccountId;
        if (!paymentAccountId) throw new UnprocessableError('Informe a conta usada para pagar a fatura.');
        await assertPayer(userId, paymentAccountId);
      }
      return toDTO(userId, await repo.create(userId, input));
    },

    async update(userId: string, id: string, input: UpdateAccountInput): Promise<AccountDTO> {
      const current = await getOwned(userId, id);
      if (input.name !== undefined && current.archivedAt === null) await assertNameFree(userId, input.name, id);

      // Mudar o tipo de ou para cartão de crédito não é permitido (decisão R9); faturas já gravadas não mudam.
      if (input.type !== undefined && input.type !== current.type && (current.type === 'credit_card' || input.type === 'credit_card')) {
        throw new UnprocessableError('Não é possível mudar o tipo de ou para cartão de crédito.');
      }
      const nextType = input.type ?? current.type;

      // Campo de cartão em conta que não é cartão → 422; aqui também cobre o caso (já impossível) de faltar campo.
      const mergedCard = {
        creditLimit: input.creditLimit ?? current.creditLimit,
        closingDay: input.closingDay ?? current.closingDay,
        dueDay: input.dueDay ?? current.dueDay,
        paymentAccountId: input.paymentAccountId ?? current.paymentAccountId,
      };
      const issues = accountCardIssues(nextType, mergedCard);
      if (issues.length > 0) throw new UnprocessableError(issues[0]!.message);

      if (nextType === 'credit_card') {
        if (input.initialBalance !== undefined && input.initialBalance !== 0) {
          throw new UnprocessableError('O saldo inicial do cartão deve ser zero.');
        }
        // Conta pagadora nova passa pelas mesmas validações da criação (decisão R9).
        if (input.paymentAccountId !== undefined) await assertPayer(userId, input.paymentAccountId);
      }

      return withBalance(userId, await repo.update(userId, id, input));
    },

    async archive(userId: string, id: string): Promise<AccountDTO> {
      await getOwned(userId, id);
      return withBalance(userId, await repo.setArchived(userId, id, new Date()));
    },

    async unarchive(userId: string, id: string): Promise<AccountDTO> {
      const account = await getOwned(userId, id);
      await assertNameFree(userId, account.name, id);
      return withBalance(userId, await repo.setArchived(userId, id, null));
    },

    async remove(userId: string, id: string): Promise<void> {
      await getOwned(userId, id);
      if (await repo.isReferenced(userId, id)) {
        throw new ConflictError('A conta possui lançamentos. Arquive-a em vez de excluir.');
      }
      await repo.delete(userId, id);
    },

    async assertUsable(userId: string, id: string): Promise<void> {
      const account = await getOwned(userId, id);
      if (account.archivedAt) throw new UnprocessableError('Não é possível lançar em uma conta arquivada.');
    },
  };
}

export type AccountsService = ReturnType<typeof createAccountsService>;
