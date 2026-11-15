import { z } from 'zod';
import type { LoanSummary, LoanWarning } from '../loan';
import { centsSchema, dateOnlySchema, idSchema } from './common';

/** Tipos de empréstimo (spec seção 3; consignado em três, como o Banco Central publica — D2). */
export const loanKindSchema = z.enum(['personal', 'payroll_inss', 'payroll_public', 'payroll_private', 'vehicle', 'mortgage', 'other']);
export type LoanKind = z.infer<typeof loanKindSchema>;

export const LOAN_KIND_LABELS: Record<LoanKind, string> = {
  personal: 'Crédito pessoal',
  payroll_inss: 'Consignado INSS',
  payroll_public: 'Consignado servidor público',
  payroll_private: 'Consignado privado (CLT)',
  vehicle: 'Financiamento de veículo',
  mortgage: 'Financiamento imobiliário',
  other: 'Outro',
};

const loanNameSchema = z.string().trim().min(1, 'Obrigatório').max(80, 'Máximo de 80 caracteres');

const fields = {
  name: loanNameSchema,
  kind: loanKindSchema,
  bankName: loanNameSchema,
  bankCnpj8: z.string().regex(/^\d{8}$/, 'CNPJ (8 primeiros dígitos) inválido').optional(),
  principal: centsSchema,
  installmentAmount: centsSchema,
  installmentsTotal: z.number('Informe um número').int('Número inteiro').min(1, 'Mínimo de 1 parcela').max(480, 'Máximo de 480 parcelas'),
  installmentsPaidBefore: z.number('Informe um número').int('Número inteiro').min(0, 'Não pode ser negativo').default(0),
  firstDueDate: dateOnlySchema,
  accountId: idSchema,
  /** Fração ao mês (0,025 = 2,5%), só para conferência (spec C8). */
  informedMonthlyRate: z.number('Informe um número').positive('Taxa deve ser maior que zero').max(1, 'Taxa acima de 100% ao mês').optional(),
};

export const createLoanSchema = z.object(fields).superRefine((v, ctx) => {
  if (v.installmentsPaidBefore >= v.installmentsTotal) {
    ctx.addIssue({ code: 'custom', path: ['installmentsPaidBefore'], message: 'Já pagas precisa ser menor que o total de parcelas' });
  }
});
export const updateLoanSchema = z.object({ name: loanNameSchema });

export type CreateLoanInput = z.output<typeof createLoanSchema>;
export type UpdateLoanInput = z.output<typeof updateLoanSchema>;

/** Empréstimo na lista. Taxas como fração; `installmentsPaid` = já pagas no cadastro + pagas no app. */
export type LoanDTO = {
  id: string;
  name: string;
  kind: LoanKind;
  bankName: string;
  bankCnpj8: string | null;
  principal: number;
  installmentAmount: number;
  installmentsTotal: number;
  installmentsPaid: number;
  monthlyRate: number;
  annualRate: number;
  outstanding: number;
  nextDue: { date: string; amount: number } | null;
};

/** Comparação com o Banco Central (spec C12; D1 e D3: período de referência e mediana do mercado). Taxas como fração. */
export type LoanComparisonDTO = {
  modality: string;
  periodStart: string;
  periodEnd: string;
  source: 'Banco Central do Brasil';
  bank: { name: string; monthlyRate: number; annualRate: number; position: number; of: number } | null;
  market: { monthlyRate: number; annualRate: number };
};

export type LoanDetailDTO = LoanDTO &
  LoanSummary & { warnings: LoanWarning[]; informedMonthlyRate: number | null; comparison: LoanComparisonDTO | null };

export type BankDTO = { cnpj8: string; name: string };
