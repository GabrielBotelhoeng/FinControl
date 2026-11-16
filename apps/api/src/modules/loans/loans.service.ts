import {
  addMonthsToYm, dateInMonth, loanSummary, loanWarnings, monthOf,
  type CreateLoanInput, type LoanDetailDTO, type LoanDTO,
} from '@fincontrol/shared';
import { MODALITY_BY_KIND } from '../../domain/loan-modalities';
import { NotFoundError, UnprocessableError } from '../../http/errors';
import type { AccountsRepository } from '../accounts/accounts.repository';
import type { BankRatesService } from '../bank-rates/bank-rates.service';
import type { CategoriesRepository } from '../categories/categories.repository';
import { DEFAULT_CATEGORIES } from '../profile/default-categories';
import type { LoanProgress, LoanRow, LoansRepository } from './loans.repository';

export const LOAN_CATEGORY_NAME = 'Empréstimos e financiamentos';

export type LoansServiceDeps = {
  repo: LoansRepository;
  accountsRepo: AccountsRepository;
  categoriesRepo: CategoriesRepository;
  bankRates: BankRatesService;
};

function toDTO(loan: LoanRow, progress: LoanProgress): LoanDTO {
  const installmentsPaid = loan.installmentsPaidBefore + progress.paidInApp;
  const summary = loanSummary({ ...loan, installmentsPaid });
  return {
    id: loan.id, name: loan.name, kind: loan.kind, bankName: loan.bankName, bankCnpj8: loan.bankCnpj8,
    principal: loan.principal, installmentAmount: loan.installmentAmount, installmentsTotal: loan.installmentsTotal,
    installmentsPaid, monthlyRate: summary.monthlyRate, annualRate: summary.annualRate, outstanding: summary.outstanding,
    nextDue: progress.nextDue,
  };
}

export function createLoansService(deps: LoansServiceDeps) {
  async function getOwned(userId: string, id: string): Promise<LoanRow> {
    const loan = await deps.repo.findById(userId, id);
    if (!loan) throw new NotFoundError('Empréstimo');
    return loan;
  }

  /** A categoria padrão; recriada se a pessoa a apagou (spec C10). */
  async function loanCategoryId(userId: string): Promise<string> {
    const existing = await deps.categoriesRepo.findByName(userId, 'expense', LOAN_CATEGORY_NAME);
    if (existing) return existing.id;
    const preset = DEFAULT_CATEGORIES.find((c) => c.name === LOAN_CATEGORY_NAME)!;
    return (await deps.categoriesRepo.ensure(userId, preset)).id;
  }

  async function detail(userId: string, loan: LoanRow): Promise<LoanDetailDTO> {
    const progress = (await deps.repo.progress(userId, [loan.id])).get(loan.id)!;
    const base = toDTO(loan, progress);
    const summary = loanSummary({ ...loan, installmentsPaid: base.installmentsPaid });
    const modality = MODALITY_BY_KIND[loan.kind];
    return {
      ...base,
      ...summary,
      informedMonthlyRate: loan.informedMonthlyRate,
      warnings: loanWarnings({ monthlyRate: summary.monthlyRate, informedMonthlyRate: loan.informedMonthlyRate, kind: loan.kind }),
      comparison: modality ? await deps.bankRates.comparison(modality.name, loan.bankCnpj8) : null,
    };
  }

  return {
    async list(userId: string): Promise<LoanDTO[]> {
      const loans = await deps.repo.list(userId);
      const progress = await deps.repo.progress(userId, loans.map((l) => l.id));
      return loans.map((l) => toDTO(l, progress.get(l.id)!));
    },

    async get(userId: string, id: string): Promise<LoanDetailDTO> {
      return detail(userId, await getOwned(userId, id));
    },

    /** Gera as parcelas X+1 … N como lançamentos pendentes na conta que paga (spec C10). */
    async create(userId: string, input: CreateLoanInput): Promise<LoanDetailDTO> {
      const account = await deps.accountsRepo.findById(userId, input.accountId);
      if (!account) throw new NotFoundError('Conta');
      if (account.archivedAt) throw new UnprocessableError('A conta que paga as parcelas não pode estar arquivada.');
      if (account.type === 'credit_card') throw new UnprocessableError('Escolha uma conta que não seja cartão para pagar as parcelas.');

      const categoryId = await loanCategoryId(userId);
      const firstMonth = monthOf(input.firstDueDate);
      const day = Number(input.firstDueDate.slice(8, 10));
      const installments = Array.from({ length: input.installmentsTotal - input.installmentsPaidBefore }, (_, i) => {
        const number = input.installmentsPaidBefore + i + 1;
        return {
          number,
          dueDate: dateInMonth(addMonthsToYm(firstMonth, number - 1), day),
          description: `${input.name} (${number}/${input.installmentsTotal})`,
        };
      });
      const loan = await deps.repo.create(
        userId,
        {
          name: input.name, kind: input.kind, bankName: input.bankName, bankCnpj8: input.bankCnpj8 ?? null,
          principal: input.principal, installmentAmount: input.installmentAmount, installmentsTotal: input.installmentsTotal,
          installmentsPaidBefore: input.installmentsPaidBefore, firstDueDate: input.firstDueDate, accountId: input.accountId,
          informedMonthlyRate: input.informedMonthlyRate ?? null,
        },
        installments,
        categoryId,
      );
      return detail(userId, loan);
    },

    /** Só o nome; as parcelas já criadas mantêm a descrição (YAGNI). */
    async rename(userId: string, id: string, name: string): Promise<LoanDetailDTO> {
      await getOwned(userId, id);
      await deps.repo.rename(userId, id, name);
      return detail(userId, await getOwned(userId, id));
    },

    async remove(userId: string, id: string): Promise<void> {
      await getOwned(userId, id);
      await deps.repo.delete(userId, id);
    },
  };
}

export type LoansService = ReturnType<typeof createLoansService>;
