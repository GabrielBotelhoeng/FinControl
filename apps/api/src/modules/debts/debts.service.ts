import {
  addDays, addMonthsToYm, dateInMonth, debtAnchorDeltas, debtStatus, debtSummary, monthOf, todayInSaoPaulo,
  type CreateDebtInput, type DebtAgreementDTO, type DebtAgreementInput, type DebtDetailDTO, type DebtDTO, type DebtNoteInput,
  type DebtPaymentInput, type DebtTimelineItemDTO, type DebtValuationInput, type UpdateDebtInput,
} from '@fincontrol/shared';
import { NotFoundError, UnprocessableError } from '../../http/errors';
import type { AccountsRepository } from '../accounts/accounts.repository';
import type { CategoriesRepository } from '../categories/categories.repository';
import {
  activeAgreement, agreementInstallments, lastAnchor, ledgerOf,
  type DebtData, type DebtsRepository, type NewDebtTransaction,
} from './debts.repository';

/** Categoria das parcelas e pagamentos (V7); criada na hora se faltar, como a de empréstimos. */
export const DEBT_CATEGORY = { name: 'Dívidas e acordos', type: 'expense' as const, icon: 'handshake', color: '#b45309' };

export const ACTIVE_AGREEMENT_MESSAGE = 'Esta dívida tem um acordo ativo. Pague as parcelas em Lançamentos ou cancele o acordo antes.';

export type DebtsServiceDeps = {
  repo: DebtsRepository;
  accountsRepo: AccountsRepository;
  categoriesRepo: CategoriesRepository;
  clock: () => Date;
};

export function createDebtsService(deps: DebtsServiceDeps) {
  const today = () => todayInSaoPaulo(deps.clock());

  /** O acordo ativo trava atualizar, pagar avulso e fechar outro — menos quando já foi todo pago (revisão final). */
  const blockingAgreement = (d: DebtData, t: string) => activeAgreement(d.events) !== null && debtSummary(ledgerOf(d), t).balance > 0;
  const assertNoBlockingAgreement = (d: DebtData, t: string) => {
    if (blockingAgreement(d, t)) throw new UnprocessableError(ACTIVE_AGREEMENT_MESSAGE);
  };

  function toDTO(d: DebtData, t = today()): DebtDTO {
    const summary = debtSummary(ledgerOf(d), t);
    // Só as parcelas do acordo ativo: um pagamento avulso desmarcado não é "próxima parcela" (revisão final).
    const pending = agreementInstallments(d)
      .filter((x) => x.status === 'pending')
      .sort((a, b) => (a.dueDate < b.dueDate ? -1 : a.dueDate > b.dueDate ? 1 : 0));
    const next = pending[0];
    return {
      id: d.row.id, name: d.row.name, creditor: d.row.creditor, kind: d.row.kind, since: d.row.since,
      ...summary,
      status: debtStatus({
        balance: summary.balance,
        lastAnchorIsAgreement: blockingAgreement(d, t),
        hasOverdueInstallment: pending.some((x) => x.dueDate < t),
      }),
      nextDue: next ? { date: next.dueDate, amount: next.amount } : null,
    };
  }

  function agreementOf(d: DebtData, t: string): DebtAgreementDTO | null {
    const a = activeAgreement(d.events);
    if (!a) return null;
    // Parcelas deste acordo: as criadas junto com ele ou depois (as de um acordo cancelado ficam de fora).
    const schedule = agreementInstallments(d).map((x) => ({
      transactionId: x.id, number: x.installmentNumber!, dueDate: x.dueDate, amount: x.amount, paidDate: x.paidDate,
      overdue: x.status === 'pending' && x.dueDate < t,
    }));
    return { date: a.date, total: a.amount, downPayment: a.downPayment, installments: a.installments, installmentAmount: a.installmentAmount, schedule };
  }

  function timelineOf(d: DebtData): DebtTimelineItemDTO[] {
    const deltas = debtAnchorDeltas(ledgerOf(d));
    const items: (DebtTimelineItemDTO & { at: string })[] = [];
    for (const e of d.events) {
      const at = e.recordedAt.toISOString();
      if (e.kind === 'valuation') items.push({ kind: 'valuation', id: e.id, date: e.date, amount: e.amount, delta: deltas.get(e.id) ?? null, note: e.note, at });
      else if (e.kind === 'note') items.push({ kind: 'note', id: e.id, date: e.date, text: e.note, amount: e.amount, at });
      else {
        items.push({
          kind: 'agreement', id: e.id, date: e.date, amount: e.amount, delta: deltas.get(e.id) ?? 0, installments: e.installments,
          installmentAmount: e.installmentAmount, downPayment: e.downPayment, cancelledAt: e.cancelledAt?.toISOString() ?? null, at,
        });
      }
    }
    for (const x of d.transactions) {
      if (x.status !== 'paid' || !x.paidDate) continue;
      items.push({ kind: 'payment', id: x.id, date: x.paidDate, amount: x.amount, description: x.description, at: x.createdAt.toISOString() });
    }
    items.sort((a, b) => (a.date === b.date ? (a.at < b.at ? 1 : a.at > b.at ? -1 : 0) : a.date < b.date ? 1 : -1));
    return items.map(({ at: _at, ...item }) => item as DebtTimelineItemDTO);
  }

  async function getOwned(userId: string, id: string): Promise<DebtData> {
    const d = await deps.repo.findOne(userId, id);
    if (!d) throw new NotFoundError('Dívida');
    return d;
  }

  async function detail(userId: string, id: string): Promise<DebtDetailDTO> {
    const d = await getOwned(userId, id);
    const t = today();
    return { ...toDTO(d, t), agreement: agreementOf(d, t), timeline: timelineOf(d), lastAnchorDate: lastAnchor(d.events)?.date ?? null };
  }

  /** Mesmas regras da conta que paga o empréstimo: existe, não está arquivada e não é cartão. */
  async function assertPayingAccount(userId: string, accountId: string) {
    const account = await deps.accountsRepo.findById(userId, accountId);
    if (!account) throw new NotFoundError('Conta');
    if (account.archivedAt) throw new UnprocessableError('A conta que paga não pode estar arquivada.');
    if (account.type === 'credit_card') throw new UnprocessableError('Escolha uma conta que não seja cartão para pagar a dívida.');
  }

  const categoryId = async (userId: string) => (await deps.categoriesRepo.ensure(userId, DEBT_CATEGORY)).id;

  return {
    /** V9: as não quitadas primeiro, do maior saldo ao menor; depois as quitadas. */
    async list(userId: string): Promise<DebtDTO[]> {
      const t = today();
      const items = (await deps.repo.load(userId)).map((d) => toDTO(d, t));
      return items.sort((a, b) => {
        const paidA = a.status === 'paid_off' ? 1 : 0;
        const paidB = b.status === 'paid_off' ? 1 : 0;
        return paidA - paidB || b.balance - a.balance;
      });
    },

    get: detail,

    /** V4: o original na data "deve desde" e, se for diferente, o valor de hoje como segunda âncora. */
    async create(userId: string, input: CreateDebtInput): Promise<DebtDetailDTO> {
      const t = today();
      if (input.since > t) throw new UnprocessableError('A data "deve desde" não pode estar no futuro.');
      const now = new Date();
      const anchors = [{ date: input.since, amount: input.originalAmount, recordedAt: now }];
      if (input.currentAmount !== undefined && input.currentAmount !== input.originalAmount) {
        anchors.push({ date: t, amount: input.currentAmount, recordedAt: new Date(now.getTime() + 1) });
      }
      const id = await deps.repo.create(
        userId,
        { name: input.name, creditor: input.creditor, kind: input.kind, originalAmount: input.originalAmount, since: input.since },
        anchors,
      );
      return detail(userId, id);
    },

    async update(userId: string, id: string, input: UpdateDebtInput): Promise<DebtDetailDTO> {
      await getOwned(userId, id);
      await deps.repo.update(userId, id, input);
      return detail(userId, id);
    },

    async remove(userId: string, id: string): Promise<void> {
      await getOwned(userId, id);
      await deps.repo.delete(userId, id);
    },

    async addValuation(userId: string, id: string, input: DebtValuationInput): Promise<DebtDetailDTO> {
      await getOwned(userId, id);
      const t = today();
      await deps.repo.addValuation(userId, id, (d) => assertNoBlockingAgreement(d, t), { date: t, amount: input.amount, note: input.note || null });
      return detail(userId, id);
    },

    async addNote(userId: string, id: string, input: DebtNoteInput): Promise<DebtDetailDTO> {
      await getOwned(userId, id);
      await deps.repo.addNote(userId, id, { date: today(), text: input.text, amount: input.amount ?? null });
      return detail(userId, id);
    },

    /** V7: entrada paga hoje e parcelas pendentes "Acordo {nome} (k/N)". */
    async createAgreement(userId: string, id: string, input: DebtAgreementInput): Promise<DebtDetailDTO> {
      const d = await getOwned(userId, id);
      const t = today();
      const check = (cur: DebtData) => {
        assertNoBlockingAgreement(cur, t);
        if (debtSummary(ledgerOf(cur), t).balance === 0) throw new UnprocessableError('Esta dívida já está quitada.');
      };
      check(d);
      if (input.firstDueDate < t) throw new UnprocessableError('O 1º vencimento do acordo não pode estar no passado.');
      if (input.firstDueDate > addDays(t, 366)) throw new UnprocessableError('O 1º vencimento do acordo deve ser em até 1 ano.');
      await assertPayingAccount(userId, input.accountId);
      const category = await categoryId(userId);
      const recordedAt = new Date();
      const base = { accountId: input.accountId, categoryId: category, installmentTotal: input.installments };
      const rows: NewDebtTransaction[] = [];
      if (input.downPayment > 0) {
        rows.push({
          // Número 0: a entrada faz parte do acordo e tem as mesmas travas das parcelas em Lançamentos (revisão final).
          ...base, amount: input.downPayment, description: `Entrada do acordo ${d.row.name}`, status: 'paid', dueDate: t, paidDate: t,
          installmentNumber: 0, installmentTotal: null, createdAt: new Date(recordedAt.getTime() + 1),
        });
      }
      const firstMonth = monthOf(input.firstDueDate);
      const day = Number(input.firstDueDate.slice(8, 10));
      for (let k = 1; k <= input.installments; k += 1) {
        rows.push({
          ...base, amount: input.installmentAmount, description: `Acordo ${d.row.name} (${k}/${input.installments})`, status: 'pending',
          dueDate: dateInMonth(addMonthsToYm(firstMonth, k - 1), day), paidDate: null, installmentNumber: k,
          createdAt: new Date(recordedAt.getTime() + 2),
        });
      }
      await deps.repo.createAgreement(
        userId, id, check,
        { date: t, downPayment: input.downPayment, installments: input.installments, installmentAmount: input.installmentAmount, recordedAt },
        rows,
      );
      return detail(userId, id);
    },

    async cancelAgreement(userId: string, id: string): Promise<DebtDetailDTO> {
      await getOwned(userId, id);
      const t = today();
      await deps.repo.cancelAgreement(userId, id, (d) => {
        const agreement = activeAgreement(d.events);
        if (!agreement) throw new UnprocessableError('Esta dívida não tem acordo ativo.');
        return { agreementId: agreement.id, amount: debtSummary(ledgerOf(d), t).balance, date: t };
      });
      return detail(userId, id);
    },

    /** V8: pagamento avulso, sem acordo, entre a última âncora e hoje, até o saldo. */
    async addPayment(userId: string, id: string, input: DebtPaymentInput): Promise<DebtDetailDTO> {
      const d = await getOwned(userId, id);
      const t = today();
      // Conferido de novo dentro da trava: dois pagamentos do saldo inteiro ao mesmo tempo não passam (revisão final).
      const check = (cur: DebtData) => {
        assertNoBlockingAgreement(cur, t);
        if (input.date > t) throw new UnprocessableError('A data do pagamento não pode estar no futuro.');
        const anchorDate = lastAnchor(cur.events)?.date;
        if (anchorDate && input.date < anchorDate) {
          throw new UnprocessableError('A data do pagamento não pode ser anterior à última atualização do valor da dívida.');
        }
        const balance = debtSummary(ledgerOf(cur), t).balance;
        if (balance === 0) throw new UnprocessableError('Esta dívida já está quitada.');
        if (input.amount > balance) throw new UnprocessableError('O pagamento é maior que o saldo da dívida. Atualize o valor antes, se ele mudou.');
      };
      check(d);
      await assertPayingAccount(userId, input.accountId);
      const category = await categoryId(userId);
      await deps.repo.addPayment(userId, id, check, {
        amount: input.amount, description: `Pagamento ${d.row.name}`, accountId: input.accountId, categoryId: category,
        status: 'paid', dueDate: input.date, paidDate: input.date, installmentNumber: null, installmentTotal: null, createdAt: new Date(),
      });
      return detail(userId, id);
    },
  };
}

export type DebtsService = ReturnType<typeof createDebtsService>;
